import os
import requests

# Fallback store for local testing
DEV_OUTBOX = []

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
    DEV_OUTBOX.append({"to": to_phone, "text": text})
    
    if os.environ.get("MESSAGING", "dev") == "dev":
        print(f"[DEV OUTBOX -> {to_phone}]: {text}")
        return

    try:
        photon_send(to_phone, text)
    except Exception as e:
        print(f"[PHOTON ERROR]: Failed to send SMS to {to_phone}: {e}")