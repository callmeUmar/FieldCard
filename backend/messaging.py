import contextvars
import hmac
import json
import os
from contextlib import contextmanager
from typing import Callable

import requests
from fastapi import APIRouter, BackgroundTasks, Request, Response, status
from pymongo.errors import DuplicateKeyError

try:
    from db import mongo, now
except ImportError:
    from backend.db import mongo, now

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

_inbound_handler: Callable[[dict], None] | None = None


def on_inbound(handler: Callable[[dict], None]) -> None:
    global _inbound_handler
    _inbound_handler = handler


def _first(*values):
    return next((v for v in values if isinstance(v, str) and v.strip()), None)


def parse_inbound(payload: dict) -> dict | None:
    if not isinstance(payload, dict):
        return None
    msg = (
        payload.get("message")
        if isinstance(payload.get("message"), dict)
        else payload.get("data")
        if isinstance(payload.get("data"), dict)
        else payload
    )
    if str(msg.get("direction", "inbound")).lower() != "inbound":
        return None

    content = msg.get("content") if isinstance(msg.get("content"), dict) else {}
    kind = content.get("type")
    if kind and kind not in ("text", "markdown", "attachment", "reply"):
        return None
    if kind == "reply" and isinstance(content.get("content"), dict):
        content = content["content"]
        kind = content.get("type")

    sender = msg.get("sender") if isinstance(msg.get("sender"), dict) else {}
    from_phone = _first(
        msg.get("from"),
        msg.get("sender") if isinstance(msg.get("sender"), str) else None,
        sender.get("phone"),
        sender.get("phoneNumber"),
        sender.get("address"),
        sender.get("handle"),
        sender.get("id"),
    )
    if not from_phone:
        return None

    media = msg.get("media") or msg.get("mediaUrl") or []
    media_url = media if isinstance(media, str) else (media[0] if isinstance(media, list) and media else None)
    if isinstance(media_url, dict):
        media_url = media_url.get("url")
    if kind == "attachment":
        media_url = media_url or _first(content.get("url"), content.get("downloadUrl"))

    text = _first(msg.get("text"), msg.get("body"), content.get("text"), content.get("markdown")) or ""
    if not text and not media_url:
        return None
    return {
        "id": _first(str(msg["id"]) if msg.get("id") is not None else None, msg.get("messageId"), msg.get("sid")),
        "from_phone": from_phone.strip(),
        "text": text.strip(),
        "image_url": media_url,
    }


def _token_ok(request: Request) -> bool:
    expected = os.getenv("PHOTON_WEBHOOK_TOKEN")
    if not expected:
        return True
    given = request.query_params.get("token") or request.headers.get("x-fieldcard-token") or ""
    return hmac.compare_digest(given, expected)


def _log(doc: dict) -> bool:
    try:
        mongo.messaging_logs.insert_one(doc)
        return True
    except DuplicateKeyError:
        return False
    except Exception as err:
        print(f"[photon] couldn't log message: {type(err).__name__}: {err}")
        return True


DEV_OUTBOX = []

_suppressed = contextvars.ContextVar("sms_suppressed", default=False)


@contextmanager
def suppressed():
    token = _suppressed.set(True)
    try:
        yield
    finally:
        _suppressed.reset(token)


def photon_send(to_phone: str, text: str) -> None:
    api_key = os.environ.get("PHOTON_API_KEY")
    project_id = os.environ.get("PHOTON_PROJECT_ID", "")

    if project_id:
        url = f"https://api.photon.codes/v1/projects/{project_id}/messages"
    else:
        url = os.environ.get("PHOTON_API_URL", "https://api.photon.codes/v1/messages")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "to": to_phone,
        "from": os.environ.get("PHOTON_PHONE_NUMBER"),
        "text": text,
        "platform": "sms",
    }

    response = requests.post(url, json=body, headers=headers, timeout=10)
    print(f"[PHOTON OUTBOUND RESPONSE] Status: {response.status_code} | Body: {response.text}")
    response.raise_for_status()


def send_text(to_phone: str, text: str) -> None:
    if _suppressed.get():
        print(f"[SMS suppressed (sandbox) -> {len(text)} chars]")
        return
    DEV_OUTBOX.append({"to": to_phone, "text": text})

    if os.environ.get("MESSAGING") == "dev":
        print(f"[DEV OUTBOX -> {to_phone}]: {text}")
        return

    try:
        photon_send(to_phone, text)
    except Exception as e:
        print(f"[PHOTON ERROR]: Failed to send SMS to {to_phone}: {e}")


@router.api_route("/photon", methods=["GET", "POST"])
@router.api_route("/webhooks/photon", methods=["GET", "POST"])
async def photon_webhook(request: Request, background: BackgroundTasks):
    if request.method == "GET":
        return Response(
            content='{"status": "ok", "message": "Photon webhook endpoint active"}',
            status_code=status.HTTP_200_OK,
            media_type="application/json",
        )
    if not _token_ok(request):
        return Response(content='{"detail": "bad token"}', status_code=401, media_type="application/json")

    raw = await request.body()
    try:
        payload = json.loads(raw or b"{}")
    except ValueError:
        payload = {"raw_body": raw.decode("utf-8", errors="ignore")}
    print(f"[WEBHOOK RECEIVED]: {payload}")

    msg = parse_inbound(payload)
    log = {"source": "photon", "payload": payload, "received_at": now(), "parsed": msg}
    if msg and msg["id"]:
        log["_id"] = f"photon_{msg['id']}"
    if not _log(log):
        return {"status": "duplicate"}
    if msg is None:
        return {"status": "ignored"}
    if _inbound_handler is None:
        print("[photon] no inbound handler registered; message logged only")
        return {"status": "logged"}

    print(f"[photon] inbound from {msg['from_phone'][-4:]}: {len(msg['text'])} chars, image={bool(msg['image_url'])}")
    background.add_task(_inbound_handler, msg)
    return {"status": "accepted"}