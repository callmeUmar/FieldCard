import os
from fastapi import APIRouter, Request, HTTPException, Response, status
from pymongo import MongoClient

router = APIRouter()

# Initialize MongoDB Connection
MONGODB_URI = os.getenv("MONGODB_URI")
PHOTON_API_KEY = os.getenv("PHOTON_API_KEY")

client = None
db = None

if MONGODB_URI:
    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_database()  # Uses default database from URI
    except Exception as e:
        print(f"MongoDB connection error: {e}")

@router.api_route("/webhooks/photon", methods=["GET", "POST"])
async def photon_webhook(request: Request):
    """
    Handles Photon Webhook / Redirect requests.
    - GET: Required for Photon's URL validation handshake.
    - POST: Receives incoming message events and logs them to MongoDB.
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
        # Fallback if payload isn't JSON
        body_bytes = await request.body()
        payload = {"raw_body": body_bytes.decode("utf-8", errors="ignore")}

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

    return {
        "status": "success",
        "received": True,
        "data": payload
    }

# --- Outbound SMS (restored: agent.py and main.py call send_text; it was
# dropped when the webhook router was added in 8ecc4f8).
import requests  # noqa: E402

import contextvars  # noqa: E402
from contextlib import contextmanager  # noqa: E402

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
    """Sends outbound SMS using Photon 2.0 API."""
    api_key = os.environ.get("PHOTON_API_KEY")
    project_id = os.environ.get("PHOTON_PROJECT_ID", "")
    
    # Construct endpoint matching Photon 2.0 spec
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
        "text": text,
        "platform": "sms"
    }
    
    response = requests.post(url, json=body, headers=headers, timeout=10)
    response.raise_for_status()

def send_text(to_phone: str, text: str) -> None:
    """Routes text via Photon or logs to dev outbox."""
    if _suppressed.get():
        print(f"[SMS suppressed (sandbox) -> {len(text)} chars]")
        return
    DEV_OUTBOX.append({"to": to_phone, "text": text})
    
    if os.environ.get("MESSAGING", "dev") == "dev":
        print(f"[DEV OUTBOX -> {to_phone}]: {text}")
        return

    try:
        photon_send(to_phone, text)
    except Exception as e:
        print(f"[PHOTON ERROR]: Failed to send SMS to {to_phone}: {e}")