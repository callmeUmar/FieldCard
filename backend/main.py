import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient

# Safe fallback imports for Render & local execution
try:
    from backend import agent, messaging
    from backend.db import find_merchant, log_activity, mongo, new_id, now
    from backend.messaging import router as messaging_router
except ImportError:
    import agent
    import messaging
    from db import find_merchant, log_activity, mongo, new_id, now
    from messaging import router as messaging_router

YES_WORDS = {"YES", "Y"}
DEMO_WORKER_ID = "w_mike"

app = FastAPI(title="Fieldcard")

# Register the messaging router so /webhooks/photon is served
app.include_router(messaging_router)

_health_client = None


@app.get("/health")
def health():
    global _health_client
    try:
        if _health_client is None:
            _health_client = MongoClient(os.getenv("MONGODB_URI"), serverSelectionTimeoutMS=2000)
        _health_client.admin.command("ping")
        db_status = "ok"
    except Exception as e:
        print(f"[health] MongoDB ping failed: {type(e).__name__}")
        db_status = "error"
    return {"ok": True, "time": now().isoformat(), "db": db_status}


class InboundMessage(BaseModel):
    from_phone: str
    text: str = ""
    image_url: str | None = None


def route_message(from_phone: str, text: str, image_url: str | None = None) -> str | None:
    company = mongo.companies.find_one({"owner_phone": from_phone})
    if company is not None:
        return agent.handle_owner_message(company, text)

    worker = mongo.workers.find_one({"phone": from_phone})
    if worker is None and os.getenv("DEMO_MODE") == "1":
        worker = _claim_demo_worker(from_phone)
    if worker is None:
        return "This number isn't registered with Fieldcard."

    offer = worker.get("offer")
    if offer:
        mongo.workers.update_one({"_id": worker["_id"]}, {"$unset": {"offer": ""}})
        if (text or "").strip().strip(".!").upper() in YES_WORDS:
            return _accept_offer(worker, offer, text)

    return agent.handle_worker_message(worker, text, image_url)


def _claim_demo_worker(phone: str) -> dict | None:
    worker = mongo.workers.find_one_and_update(
        {"_id": DEMO_WORKER_ID}, {"$set": {"phone": phone}}, return_document=True
    )
    if worker is not None:
        log_activity("demo", f"{worker['name']} reassigned to a new phone for the demo")
    return worker


def _accept_offer(worker: dict, offer: dict, text: str) -> str | None:
    for card in mongo.cards.find({"worker_id": worker["_id"], "state": "active"}):
        agent.provider.terminate_card(card["_id"])
        log_activity("card_terminated", f"Card ending {card['last4']} terminated", offer["job_id"])

    company = mongo.companies.find_one({"_id": worker["company_id"]})
    result = agent.request_card_flow(
        worker,
        company,
        offer["job_id"],
        offer["merchant"],
        f"Purchase at {offer['merchant']} after a declined card",
        offer["amount"],
        text,
    )
    if result["status"] == "waiting_for_owner":
        return f"Asked {company['owner_name']}. I'll text you when they answer."
    if result["status"] == "issued":
        return None
    return "Can't get a card there: " + " ".join(result["reasons"])


def _require_dev():
    if os.getenv("MESSAGING", "dev") != "dev":
        raise HTTPException(404)


@app.post("/api/dev/message")
def dev_message(msg: InboundMessage):
    _require_dev()
    reply = route_message(msg.from_phone, msg.text, msg.image_url)
    if reply:
        messaging.send_text(msg.from_phone, reply)
    return {"reply": reply}


@app.get("/api/dev/outbox")
def dev_outbox():
    _require_dev()
    return messaging.DEV_OUTBOX


class SimulatedPurchase(BaseModel):
    worker_id: str
    merchant_name: str
    amount: float


def _decline_text(reason: str | None, card: dict, req: dict) -> str:
    return {
        "merchant_category_not_allowed": f"this card only works at {req.get('merchant', 'the approved store')}",
        "over_amount_cap": f"over the card's ${card['amount_cap_usd']:.2f} cap",
        "card_expired": "the card has expired",
        "card_used": "the card was already used",
        "card_terminated": "the card was cancelled",
        # Reason text from cards.MockProvider:
        "this card only works at the approved store type": f"this card only works at {req.get('merchant', 'the approved store')}",
    }.get(reason, reason or "declined by the card network")


def _record_tiger(company_id, job_id, worker_id, amount, mcc, result) -> None:
    try:
        try:
            from backend import tiger
        except ImportError:
            import tiger
        tiger.record_spend_event(company_id, job_id, worker_id, amount, mcc, result)
    except Exception as e:
        print(f"[tiger] record_spend_event skipped: {e!r}")


@app.post("/api/simulate/purchase")
def simulate_purchase(body: SimulatedPurchase):
    worker = mongo.workers.find_one({"_id": body.worker_id})
    if worker is None:
        raise HTTPException(404, "Unknown worker")

    # Newest active card, even if expired: the provider decides and records why.
    card = mongo.cards.find_one({"worker_id": worker["_id"], "state": "active"}, sort=[("expires_at", -1)])
    if card is None:
        return {"status": "declined", "result": "declined", "reason": "no_active_card", "decline_reason": "no_active_card"}

    req = mongo.requests.find_one({"_id": card["request_id"]}) or {}
    job_id = req.get("job_id")
    merchant = find_merchant(body.merchant_name)
    merchant_name = merchant["name"] if merchant else body.merchant_name
    mcc = merchant["mcc"] if merchant else "0000"  # unknown store: matches no card

    # The provider enforces the card's allowed MCCs, amount cap and expiry.
    outcome = agent.provider.simulate_purchase(card["_id"], merchant_name, mcc, body.amount)
    txn = {
        "_id": new_id("txn"),
        "card_id": card["_id"],
        "job_id": job_id,
        "merchant_name": merchant_name,
        "mcc": mcc,
        "amount_usd": body.amount,
        "result": outcome["result"],
        "decline_reason": outcome["decline_reason"],
        "occurred_at": now(),
    }
    mongo.transactions.insert_one(txn)
    _record_tiger(worker["company_id"], job_id, worker["_id"], body.amount, mcc, outcome["result"])

    if outcome["result"] == "approved":
        if job_id:
            mongo.jobs.update_one({"_id": job_id}, {"$inc": {"spent_usd": body.amount}})
        ir = mongo.intent_receipts.find_one_and_update(
            {"request_id": card["request_id"]}, {"$push": {"transaction_ids": txn["_id"]}}, return_document=True
        )
        if ir is not None:
            # Re-seal so the hash covers the new transaction.
            mongo.intent_receipts.update_one({"_id": ir["_id"]}, {"$set": {"hash": agent.intent_hash(ir)}})
        message = f"Approved ${body.amount:.2f} at {merchant_name}. Text me a photo of the receipt."
        log_activity("purchase_approved", f"{worker['name']} spent ${body.amount:.2f} at {merchant_name}", job_id)
    else:
        reason = _decline_text(outcome["decline_reason"], card, req)
        mongo.workers.update_one(
            {"_id": worker["_id"]},
            {"$set": {"offer": {"job_id": job_id, "merchant": merchant_name, "amount": body.amount}}},
        )
        message = f"Declined at {merchant_name}: {reason}. Reply YES to ask the owner for a card there."
        log_activity(
            "purchase_declined", f"{worker['name']} declined at {merchant_name} (${body.amount:.2f}): {reason}", job_id
        )
    messaging.send_text(worker["phone"], message)

    # result/decline_reason per contracts.md (dashboard); status/reason/message kept from the previous version.
    return {
        "result": outcome["result"],
        "decline_reason": outcome["decline_reason"],
        "status": outcome["result"],
        "reason": outcome["decline_reason"],
        "message": message,
        "transaction_id": txn["_id"],
        "card_id": card["_id"],
    }


# ---------- VEYZL audit endpoint
# VEYZL posts {"msg", "image" | "imageBase64"} and expects the real model's
# answer. Text runs through the real agent as sandbox worker w_veyzl (mock
# cards, no SMS, approvals closed after each call); images run through vision.

import base64  # noqa: E402
import re  # noqa: E402
import threading  # noqa: E402
import time  # noqa: E402
from contextlib import nullcontext  # noqa: E402

from fastapi import Request  # noqa: E402
from starlette.concurrency import run_in_threadpool  # noqa: E402

try:
    from backend import seed
except ImportError:
    import seed

AUDIT_WORKER = {
    "_id": "w_veyzl",
    "company_id": "co_ballard",
    "name": "VEYZL Auditor",
    "phone": "sandbox:veyzl",  # not a phone number, so nothing can be texted to it
    "per_purchase_limit_usd": 300,
}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
_CARD_NUMBER = re.compile(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)")
_SECRET_VARS = ("GEMINI_API_KEY", "MONGODB_URI", "PHOTON_API_KEY", "PERCEPTRON_API_KEY", "BACKBOARD_API_KEY", "TIGER_DATABASE_URL")
_audit_lock = threading.Lock()  # one sandbox worker, so audit calls take turns


def _scrub(text: str) -> str:
    text = _CARD_NUMBER.sub("[redacted]", text)
    for var in _SECRET_VARS:
        if os.getenv(var):
            text = text.replace(os.environ[var], "[redacted]")
    return text


def _image_mime(data: bytes) -> str:
    if data.startswith(b"\x89PNG"):
        return "image/png"
    if data.startswith(b"GIF8"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return "image/jpeg"


def _audit_image(b64: str, msg: str) -> tuple[str, str]:
    if b64.startswith("data:") and "," in b64:
        b64 = b64.split(",", 1)[1]  # data:image/png;base64,....
    b64 = "".join(b64.split())
    try:
        data = base64.b64decode(b64 + "=" * (-len(b64) % 4))
    except Exception:
        data = b""
    if not data:
        return "Couldn't decode the image. Send it as base64 in \"image\" or \"imageBase64\".", "bad-image"
    if len(data) > MAX_IMAGE_BYTES:
        return "Image is too large (max 10 MB).", "too-large"
    answer, source = agent.vision.ask_about_image(data, msg or "Describe this image.", _image_mime(data))
    return answer or "(The model returned no text.)", source


def _end_sandbox_cards() -> None:
    for card in agent.db.mongo.cards.find({"worker_id": AUDIT_WORKER["_id"], "state": "active"}):
        agent.provider.terminate_card(card["_id"])


def _close_sandbox_approvals() -> None:
    # Otherwise the owner's next YES could approve an audit request.
    req_ids = [r["_id"] for r in agent.db.mongo.requests.find({"worker_id": AUDIT_WORKER["_id"]}, {"_id": 1})]
    agent.db.mongo.approvals.update_many(
        {"request_id": {"$in": req_ids}, "status": "pending"},
        {"$set": {"status": "denied", "decided_at": now()}},
    )


def _audit_agent(msg: str) -> tuple[str, str]:
    mongo_ = agent.db.mongo
    if mongo_.companies.find_one({"_id": AUDIT_WORKER["company_id"]}) is None:
        seed.seed()
    mongo_.workers.replace_one({"_id": AUDIT_WORKER["_id"]}, AUDIT_WORKER, upsert=True)
    with _audit_lock:
        _end_sandbox_cards()
        agent.chats.pop(AUDIT_WORKER["phone"], None)  # each audit call is a fresh conversation
        started = now()
        try:
            reply = agent.handle_worker_message(dict(AUDIT_WORKER), msg)
        finally:
            _end_sandbox_cards()
            _close_sandbox_approvals()
            agent.chats.pop(AUDIT_WORKER["phone"], None)
        last = mongo_.requests.find_one(
            {"worker_id": AUDIT_WORKER["_id"], "created_at": {"$gte": started}}, sort=[("created_at", -1)]
        )
    outcome = f"policy={last['status']}" if last else "no card request"
    if reply is None:  # Gemini failed after a card was issued; details only go by text
        reply = "A card was issued for this request. Card details are only sent by text."
    return reply, outcome


def _audit(payload: dict) -> dict:
    started = time.monotonic()
    msg = str(payload.get("msg") or "").strip()
    image = payload.get("image") or payload.get("imageBase64")
    kind, detail, db_mode = "empty", "", "atlas"
    try:
        db_mode = "atlas" if agent.db.reachable() else "memory"
        with agent.db.in_memory() if db_mode == "memory" else nullcontext(), agent.messaging.suppressed():
            if isinstance(image, str) and image.strip():
                kind = "image"
                text, detail = _audit_image(image, msg)
            elif msg:
                kind = "agent"
                text, detail = _audit_agent(msg)
            else:
                text = 'Send JSON {"msg": "..."} and optionally "image" or "imageBase64" (base64).'
    except Exception as e:
        kind, detail = "error", f"{type(e).__name__} {getattr(e, 'code', '')}".strip()
        text = "Fieldcard couldn't process this request right now."
    text = _scrub(text)
    print(
        f"[audit] {kind} ({detail}) db={db_mode} msg={msg[:60]!r} "
        f"-> {len(text)} chars in {time.monotonic() - started:.1f}s"
    )
    return {"response": text}


@app.post("/ai/audit")
async def ai_audit(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {"msg": str(payload)}
    return await run_in_threadpool(_audit, payload)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)