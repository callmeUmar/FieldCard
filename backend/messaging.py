"""Messaging over Photon (iMessage) and the dev outbox.

Photon 2.0 API (https://api.photon.codes, spec: https://api.photon.codes/openapi.json):
- Inbound: Photon POSTs webhook events to /webhooks/photon. A text from a person is
  {"type": "message.received", "data": {"projectId", "object": {id, status: "received",
  sentBy: {handle}, receivedBy: {id}, space: {id}, content: {type: "text", text}}}}.
  Every other event (dispatched, delivered, failed, typing, ...) is ignored; some of
  them describe OUR replies and must never be treated as new texts.
- Outbound: there is no "send to a phone number". A message goes into a conversation:
  POST /v1/projects/{projectId}/messages {senderId, spaceId, content}, as our line's user.
  So every inbound text records its conversation, and send_text() replies into it.
  A shared iMessage line can only message people who have texted it first.
"""
import contextvars
import hmac
import json
import os
from contextlib import contextmanager
from typing import Callable

import requests
from fastapi import APIRouter, BackgroundTasks, Request, Response, status
from pymongo.errors import DuplicateKeyError

try:  # the same db module agent.py uses
    from db import mongo, now
except ImportError:
    from backend.db import mongo, now

PHOTON_API = os.getenv("PHOTON_API_URL", "https://api.photon.codes").rstrip("/")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# main.py registers the function that routes an inbound text to the owner flow or
# the Gemini agent (route_message) and texts back the reply.
_inbound_handler: Callable[[dict], None] | None = None


def on_inbound(handler: Callable[[dict], None]) -> None:
    global _inbound_handler
    _inbound_handler = handler


def _first(*values):
    return next((v for v in values if isinstance(v, str) and v.strip()), None)


def _obj(value) -> dict:
    return value if isinstance(value, dict) else {}


def parse_inbound(payload: dict) -> dict | None:
    """Normalizes an inbound webhook to {id, from_phone, text, image_url, space_id,
    line_user_id, project_id}, or returns None for anything that isn't a new text
    from a person.

    Accepts Photon 2.0 events ({"type": "message.received", "data": {"object": ...}}),
    Spectrum-style {"message": {...}}, and a flat {"from", "text"} shape (dev/tests).
    """
    if not isinstance(payload, dict):
        return None
    event_type = payload.get("type")
    if isinstance(event_type, str) and "." in event_type and event_type != "message.received":
        return None  # message.dispatched / delivered / failed / typing ...: not a new text

    data = _obj(payload.get("data"))
    if isinstance(data.get("object"), dict):
        msg = data["object"]
    elif isinstance(payload.get("message"), dict):
        msg = payload["message"]
    elif data:
        msg = data
    else:
        msg = payload

    if str(msg.get("status", "received")).lower() != "received":
        return None  # our own outbound message's lifecycle
    if str(msg.get("direction", "inbound")).lower() not in ("inbound", "received"):
        return None

    content = _obj(msg.get("content"))
    kind = content.get("type")
    if kind and kind not in ("text", "markdown", "attachment", "reply"):
        return None  # typing, read receipts, reactions, polls ...
    if kind == "reply" and isinstance(content.get("content"), dict):
        content = content["content"]
        kind = content.get("type")

    sent_by, sender = _obj(msg.get("sentBy")), _obj(msg.get("sender"))
    from_phone = _first(
        msg.get("from"),
        sent_by.get("handle"),
        sent_by.get("phone"),
        sender.get("phone"),
        sender.get("phoneNumber"),
        sender.get("handle"),
        msg.get("sender") if isinstance(msg.get("sender"), str) else None,
        sender.get("address"),
        sender.get("id"),
    )
    if not from_phone:
        return None

    media = msg.get("media") or msg.get("mediaUrl") or []
    media_url = media if isinstance(media, str) else (media[0] if isinstance(media, list) and media else None)
    if isinstance(media_url, dict):
        media_url = media_url.get("url")
    if kind == "attachment":
        # Photon 2.0 attachments carry an attachmentId, not a URL; only a URL can be read here.
        media_url = media_url or _first(content.get("url"), content.get("downloadUrl"))

    text = _first(msg.get("text"), msg.get("body"), content.get("text"), content.get("markdown")) or ""
    if not text and not media_url:
        return None

    return {
        "id": _first(str(msg["id"]) if msg.get("id") is not None else None, msg.get("messageId"), payload.get("id")),
        "from_phone": from_phone.strip(),
        "text": text.strip(),
        "image_url": media_url,
        "space_id": _first(_obj(msg.get("space")).get("id"), msg.get("spaceId")),
        "line_user_id": _first(_obj(msg.get("receivedBy")).get("id")),
        "project_id": _first(data.get("projectId"), msg.get("projectId")),
    }


# ---------- conversations: who we can text, and where


def _handle_key(handle: str) -> str:
    """Phone handles compare by their last 10 digits; anything else (e.g. an Apple ID email) as-is."""
    digits = "".join(ch for ch in handle if ch.isdigit())
    return digits[-10:] if len(digits) >= 10 else handle.strip().lower()


def remember_conversation(msg: dict) -> None:
    """Records which Photon space to reply into for this person, as which line."""
    if not (msg.get("space_id") and msg.get("line_user_id")):
        return
    try:
        mongo.photon_conversations.replace_one(
            {"_id": _handle_key(msg["from_phone"])},
            {
                "_id": _handle_key(msg["from_phone"]),
                "handle": msg["from_phone"],
                "space_id": msg["space_id"],
                "line_user_id": msg["line_user_id"],
                "project_id": msg.get("project_id"),
                "updated_at": now(),
            },
            upsert=True,
        )
    except Exception as err:
        print(f"[photon] couldn't store conversation: {type(err).__name__}: {err}")


def _conversation_for(handle: str) -> dict | None:
    try:
        return mongo.photon_conversations.find_one({"_id": _handle_key(handle)})
    except Exception as err:
        print(f"[photon] couldn't read conversation: {type(err).__name__}: {err}")
        return None


# ---------- outbound

DEV_OUTBOX: list[dict] = []

_suppressed = contextvars.ContextVar("sms_suppressed", default=False)


@contextmanager
def suppressed():
    """No message leaves the server inside this block (used by the /ai/audit sandbox)."""
    token = _suppressed.set(True)
    try:
        yield
    finally:
        _suppressed.reset(token)


def photon_send(to_phone: str, text: str) -> bool:
    """Sends a text into this person's Photon conversation. Returns True if Photon accepted it."""
    conv = _conversation_for(to_phone)
    if conv is None:
        print(f"[photon] can't message …{to_phone[-4:]}: no iMessage conversation yet (they must text the line first)")
        return False
    project_id = conv.get("project_id") or os.getenv("PHOTON_PROJECT_ID")
    api_key = os.getenv("PHOTON_API_KEY")
    if not project_id or not api_key:
        print("[photon] can't send: PHOTON_API_KEY or the project id is missing")
        return False
    response = requests.post(
        f"{PHOTON_API}/v1/projects/{project_id}/messages",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "senderId": conv["line_user_id"],
            "spaceId": conv["space_id"],
            "content": {"type": "text", "format": "plain", "text": text},
        },
        timeout=15,
    )
    print(f"[PHOTON OUTBOUND RESPONSE] Status: {response.status_code} | Body: {response.text[:300]}")
    return response.status_code < 300


def send_text(to_phone: str, text: str) -> None:
    """Texts someone: via Photon, or only into the dev outbox when MESSAGING=dev."""
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
        print(f"[PHOTON ERROR]: Failed to send to …{to_phone[-4:]}: {type(e).__name__}: {e}")


# ---------- inbound webhook


def _token_ok(request: Request) -> bool:
    """If PHOTON_WEBHOOK_TOKEN is set, the webhook URL must carry ?token=<it>,
    so nobody else can post fake texts (e.g. an owner "YES")."""
    expected = os.getenv("PHOTON_WEBHOOK_TOKEN")
    if not expected:
        return True
    given = request.query_params.get("token") or request.headers.get("x-fieldcard-token") or ""
    return hmac.compare_digest(given, expected)


def _log(doc: dict) -> bool:
    """Logs the delivery; returns False if this message was already handled (Photon retries)."""
    try:
        mongo.messaging_logs.insert_one(doc)
        return True
    except DuplicateKeyError:
        return False
    except Exception as err:
        print(f"[photon] couldn't log message: {type(err).__name__}: {err}")
        return True


# router prefix is "/webhooks", so this serves /webhooks/photon
@router.api_route("/photon", methods=["GET", "POST"])
async def photon_webhook(request: Request, background: BackgroundTasks):
    """
    - GET: URL validation handshake.
    - POST: a Photon event. Answered right away (2xx); a new text is routed to the
      owner flow or the Gemini agent in the background and the reply is sent back.
    """
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

    msg = parse_inbound(payload)
    print(f"[WEBHOOK RECEIVED] type={payload.get('type') if isinstance(payload, dict) else '?'} -> {'text' if msg else 'ignored'}")
    log = {"source": "photon", "payload": payload, "received_at": now(), "parsed": msg}
    if msg and msg["id"]:
        log["_id"] = f"photon_{msg['id']}"  # Photon may retry: handle each message once
    if not _log(log):
        return {"status": "duplicate"}
    if msg is None:
        return {"status": "ignored"}

    remember_conversation(msg)
    if _inbound_handler is None:
        print("[photon] no inbound handler registered; message logged only")
        return {"status": "logged"}

    print(f"[photon] inbound from …{msg['from_phone'][-4:]}: {len(msg['text'])} chars, image={bool(msg['image_url'])}")
    background.add_task(_inbound_handler, msg)
    return {"status": "accepted"}
