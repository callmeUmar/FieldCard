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
    """Normalizes a Photon webhook payload to {id, from_phone, text, image_url}."""
    if not isinstance(payload, dict):
        return None

    # Handle Spectrum / Photon event wrapper: {"data": {"object": {...}}}
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("object"), dict):
        msg = data["object"]
    elif isinstance(payload.get("message"), dict):
        msg = payload["message"]
    elif isinstance(data, dict):
        msg = data
    else:
        msg = payload

    # Ignore non-inbound direction if specified
    direction = str(msg.get("direction", "inbound")).lower()
    if direction not in ("inbound", "received"):
        return None

    content = msg.get("content") if isinstance(msg.get("content"), dict) else {}
    kind = content.get("type")
    if kind and kind not in ("text", "markdown", "attachment", "reply"):
        return None
    if kind == "reply" and isinstance(content.get("content"), dict):
        content = content["content"]

    # Extract sender phone from sentBy, sender, or flat fields
    sent_by = msg.get("sentBy") if isinstance(msg.get("sentBy"), dict) else {}
    sender = msg.get("sender") if isinstance(msg.get("sender"), dict) else {}

    from_phone = _first(
        msg.get("from"),
        sent_by.get("handle"),
        sent_by.get("phone"),
        sender.get("phone"),
        sender.get("phoneNumber"),
        sender.get("handle"),
        msg.get("sender") if isinstance(msg.get("sender"), str) else None,
    )
    if not from_phone:
        return None

    # Extract media / attachments
    media = msg.get("media") or msg.get("mediaUrl") or []
    media_url = media if isinstance(media, str) else (media[0] if isinstance(media, list) and media else None)
    if isinstance(media_url, dict):
        media_url = media_url.get("url")
    if kind == "attachment":
        media_url = media_url or _first(content.get("url"), content.get("downloadUrl"))

    # Extract message body text
    text = _first(msg.get("text"), msg.get("body"), content.get("text"), content.get("markdown")) or ""
    if not text and not media_url:
        return None

    msg_id = _first(
        str(msg["id"]) if msg.get("id") is not None else None,
        msg.get("messageId"),
        payload.get("id"),
    )

    return {
        "id": msg_id,
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