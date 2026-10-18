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
        "merchant_category_not_allowed": f"this card only works at {req['merchant']}",
        "over_amount_cap": f"over the card's ${card['amount_cap_usd']:.2f} cap",
        "card_expired": "the card has expired",
        "card_used": "the card was already used",
        "card_terminated": "the card was cancelled",
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

    card = mongo.cards.find_one({"worker_id": worker["_id"], "state": "active"})
    if card is None:
        return {"status": "declined", "reason": "no_active_card"}

    req = mongo.card_requests.find_one({"_id": card["request_id"]})
    merchant = find_merchant(body.merchant_name)
    mcc = merchant.get("mcc", "0000") if merchant else "0000"

    # Evaluation check
    reason = None
    if card.get("expires_at") and card["expires_at"] < now():
        reason = "card_expired"
    elif card.get("used", False):
        reason = "card_used"
    elif body.amount > card.get("amount_cap_usd", 0):
        reason = "over_amount_cap"

    if reason:
        _record_tiger(worker["company_id"], card.get("job_id"), worker["_id"], body.amount, mcc, "declined")
        decline_msg = _decline_text(reason, card, req or {})
        return {"status": "declined", "reason": reason, "message": decline_msg}

    # Successful authorization
    mongo.cards.update_one({"_id": card["_id"]}, {"$set": {"used": True, "state": "used"}})
    _record_tiger(worker["company_id"], card.get("job_id"), worker["_id"], body.amount, mcc, "approved")
    return {"status": "approved", "card_id": card["_id"]}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)