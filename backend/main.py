import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient

import agent
import messaging
from backend.messaging import router as messaging_router
from db import find_merchant, log_activity, mongo, new_id, now

YES_WORDS = {"YES", "Y"}
DEMO_WORKER_ID = "w_mike"

app = FastAPI(title="Fieldcard")

# Register the messaging router so /webhooks/photon is served
app.include_router(messaging_router)

_health_client = None


@app.get("/health")
def health():
    # Separate client with a short timeout so a database outage can't hang
    # this endpoint for pymongo's default 30s.
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


# TEMPORARY: minimal message routing so purchases can be demoed end to end.
# Muhammad's main.py skeleton and Photon webhooks replace this section;
# keep route_message's offer and DEMO_MODE handling when merging.
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
        # The offer only stands for the very next reply, so a later "yes"
        # (e.g. confirming an estimate) can't trigger it by accident.
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
        return None  # issue_card already texted the card details
    return "Can't get a card there: " + " ".join(result["reasons"])


def _require_dev():
    if os.getenv("MESSAGING", "dev") != "dev":
        raise HTTPException(404)


@app.post("/api/dev/message")
def dev_message(msg: InboundMessage):
    _require_dev()
    reply = route_message(msg.from_phone, msg.text, msg.image_url)
    if reply:  # None: nothing more to send (e.g. the card text already went out)
        messaging.send_text(msg.from_phone, reply)
    return {"reply": reply}


@app.get("/api/dev/outbox")
def dev_outbox():
    _require_dev()
    return messaging.DEV_OUTBOX


# End TEMPORARY section.


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
    # Tiger is a nice-to-have; an outage or missing module must never break the demo.
    try:
        import tiger

        tiger.record_spend_event(company_id, job_id, worker_id, amount, mcc, result)
    except Exception as e:
        print(f"[tiger] record_spend_event skipped: {e!r}")


@app.post("/api/simulate/purchase")
def simulate_purchase(body: SimulatedPurchase):
    worker = mongo.workers.find_one({"_id": body.worker_id})
    if worker is None:
        raise HTTPException(404, "Unknown worker")
    card = mongo.cards.find_