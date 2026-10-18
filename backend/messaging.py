# TEMPORARY: dev-only stand-in so agent.py can run. Muhammad will replace this
# file with the Photon SMS adapter. Keep send_text(to_phone, text) from contracts.md.
from db import now

DEV_OUTBOX: list[dict] = []


def send_text(to_phone: str, text: str) -> None:
    print(f"[SMS -> {to_phone}] {text}")
    DEV_OUTBOX.append({"to_phone": to_phone, "text": text, "at": now()})
