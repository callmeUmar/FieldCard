import hmac
import json
import os
import requests
import contextvars
from contextlib import contextmanager
from fastapi import APIRouter, Request, Response, status
from pymongo import MongoClient

router = APIRouter()

# main.py registers the function that routes an inbound text to the owner flow
# or the Gemini agent (route_message) and texts back the reply.
_inbound_handler: Callable[[dict], None] | None = None


def on_inbound(handler: Callable[[dict], None]) -> None:
    global _inbound_handler
    _inbound_handler = handler


def _first(*values):
    return next((v for v in values if isinstance(v, str) and v.strip()), None)


def parse_inbound(payload: dict) -> dict | None:
    """Normalizes a Photon webhook payload to {id, from_phone, text, image_url}.

    Accepts both shapes we may receive:
      - flat: {"from"|"sender": "+1555...", "text"|"body": "...", "media"|"mediaUrl": ...}
      - Spectrum message: {"id", "direction", "content": {"type": "text", "text"}, "sender": {...}},
        optionally wrapped in {"message": {...}} or {"data": {...}}
    Returns None for anything that isn't an inbound message (outbound echoes,
    typing, read receipts, reactions) or has no sender.
    """
    if not isinstance(payload, dict):
        return None
    msg = payload.get("message") if isinstance(payload.get("message"), dict) else payload.get("data") if isinstance(payload.get("data"), dict) else payload
    if str(msg.get("direction", "inbound")).lower() != "inbound":
        return None

    content = msg.get("content") if isinstance(msg.get("content"), dict) else {}
    kind = content.get("type")
    if kind and kind not in ("text", "markdown", "attachment", "reply"):
        return None  # typing, read, reaction, edit, ...
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
    """If PHOTON_WEBHOOK_TOKEN is set, the webhook URL must carry ?token=<it>,
    so nobody else can post fake texts (e.g. an owner "YES")."""
    expected = os.getenv("PHOTON_WEBHOOK_TOKEN")
    if not expected:
        return True
    given = request.query_params.get("token") or request.headers.get("x-fieldcard-token") or ""
    return hmac.compare_digest(given, expected)


def _log(doc: dict) -> bool:
    """Logs the delivery; returns False if this message id was already handled (retry)."""
    try:
        mongo.messaging_logs.insert_one(doc)
        return True
    except DuplicateKeyError:
        return False
    except Exception as err:
        print(f"[photon] couldn't log message: {type(err).__name__}: {err}")
        return True


# Fallback store for local testing
DEV_OUTBOX = []

_suppressed = contextvars.ContextVar("sms_suppressed", default=False)


@contextmanager
def suppressed():
    """No SMS leaves the server inside this block (used by the /ai/audit sandbox)."""
    token = _suppressed.set(True)
    try:
        yield
    finally:
        _suppressed.reset(token)


def parse_inbound(payload: dict) -> dict:
    """Extracts standard fields from Photon webhook payloads."""
    media = payload.get("media") or payload.get("mediaUrl") or []
    if isinstance(media, str):
        media_url = media
    else:
        media_url = media[0] if media else None

    return {
        "from_phone": payload.get("from") or payload.get("sender"),
        "text": payload.get("text") or payload.get("body") or "",
        "image_url": media_url
    }


def photon_send(to_phone: str, text: str) -> None:
    """Sends outbound SMS using Photon API."""
    api_key = os.environ.get("PHOTON_API_KEY")
    project_id = os.environ.get("PHOTON_PROJECT_ID", "")
    
    if project_id:
        url = f"https://api.photon.codes/v1/projects/{project_id}/messages"
    else:
        url = os.environ.get("PHOTON_API_URL", "https://api.photon.codes/v1/messages")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    body = {
        "to": to_phone,
        "from": os.environ.get("PHOTON_PHONE_NUMBER"),
        "text": text,
        "platform": "sms"
    }
    
    response = requests.post(url, json=body, headers=headers, timeout=10)
    print(f"[PHOTON OUTBOUND RESPONSE] Status: {response.status_code} | Body: {response.text}")
    response.raise_for_status()


def send_text(to_phone: str, text: str) -> None:
    """Routes text via Photon or logs to dev outbox."""
    if _suppressed.get():
        print(f"[SMS suppressed (sandbox) -> {len(text)} chars]")
        return
    DEV_OUTBOX.append({"to": to_phone, "text": text})
    
    # Check if MESSAGING environment variable is explicitly set to dev
    if os.environ.get("MESSAGING") == "dev":
        print(f"[DEV OUTBOX -> {to_phone}]: {text}")
        return

    try:
        photon_send(to_phone, text)
    except Exception as e:
        print(f"[PHOTON ERROR]: Failed to send SMS to {to_phone}: {e}")


@router.api_route("/webhooks/photon", methods=["GET", "POST"])
async def photon_webhook(request: Request):
    """
    Handles Photon Webhook requests.
    - GET: Required for Photon's URL validation handshake.
    - POST: Receives incoming message events, logs them, routes them to Gemini, and replies.
    """
    # 1. Validation Handshake (GET)
    if request.method == "GET":
        return Response(
            content='{"status": "ok", "message": "Photon webhook endpoint active"}',
            status_code=status.HTTP_200_OK,
            media_type="application/json"
        )

    # 2. Incoming Event Payload (POST)
    try:
        payload = await request.json()
    except Exception:
        body_bytes = await request.body()
        payload = {"raw_body": body_bytes.decode("utf-8", errors="ignore")}

    print(f"[WEBHOOK RECEIVED]: {payload}")

    # Log payload to MongoDB if connection exists
    if db is not None:
        try:
            db.messaging_logs.insert_one({
                "source": "photon",
                "payload": payload,
                "timestamp": request.headers.get("x-request-timestamp") or os.environ.get("BUILD_TIME")
            })
        except Exception as err:
            print(f"Failed to log message to MongoDB: {err}")

    # 3. Parse and Route to Gemini Agent
    parsed = parse_inbound(payload)
    from_phone = parsed.get("from_phone")
    incoming_text = parsed.get("text")
    image_url = parsed.get("image_url")

    if from_phone and (incoming_text or image_url):
        # Lazy import route_message from main to avoid circular imports
        try:
            from main import route_message
            reply = route_message(from_phone, incoming_text, image_url)
            print(f"[AGENT REPLY]: {reply}")
            if reply:
                send_text(from_phone, reply)
        except Exception as e:
            print(f"[WEBHOOK EXECUTION ERROR]: {e}")

    return {
        "status": "success",
        "received": True,
        "data": payload
    }