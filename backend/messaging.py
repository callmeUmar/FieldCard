import os
import requests
import contextvars
from contextlib import contextmanager
from fastapi import APIRouter, Request, Response, status
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