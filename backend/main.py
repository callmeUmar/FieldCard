import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import agent
import messaging
from db import find_merchant, log_activity, mongo, new_id, now

YES_WORDS = {"YES", "Y"}
DEMO_WORKER_ID = "w_mike"

app = FastAPI(title="Fieldcard")


# TEMPORARY: minimal message routing so purchases can be demoed end to end.
# Muhammad's main.py skeleton and Photon webhooks replace this section;
# keep route_message's offer and DEMO_MODE handling when merging.
class InboundMessage(BaseModel):
    from_phone: str
    text: str = ""
    image_url: str | None = None


def route_message(from_phone: str, text: str, image_url: str | None = None) -> str:
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


def _accept_offer(worker: dict, offer: dict, text: str) -> str:
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
        return (
            f"New card ending {result['last4']}, cap ${result['cap_usd']:.2f}, "
            f"{result['store']} only, expires in {result['expires_in_hours']} hours."
        )
    return "Can't get a card there: " + " ".join(result["reasons"])


def _require_dev():
    if os.getenv("MESSAGING", "dev") != "dev":
        raise HTTPException(404)


@app.post("/api/dev/message")
def dev_message(msg: InboundMessage):
    _require_dev()
    reply = route_message(msg.from_phone, msg.text, msg.image_url)
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
    card = mongo.cards.find_one(
        {"worker_id": worker["_id"], "state": "active", "expires_at": {"$gt": now()}},
        sort=[("expires_at", -1)],
    )
    if card is None:
        raise HTTPException(404, "Worker has no active card")
    merchant = find_merchant(body.merchant_name)
    if merchant is None:
        raise HTTPException(404, "Unknown merchant")
    req = mongo.requests.find_one({"_id": card["request_id"]})
    job_id = req["job_id"]

    outcome = agent.provider.simulate_purchase(card["_id"], merchant["name"], merchant["mcc"], body.amount)
    txn = {
        "_id": new_id("txn"),
        "card_id": card["_id"],
        "job_id": job_id,
        "merchant_name": merchant["name"],
        "mcc": merchant["mcc"],
        "amount_usd": body.amount,
        "result": outcome["result"],
        "decline_reason": outcome["decline_reason"],
        "occurred_at": now(),
    }
    mongo.transactions.insert_one(txn)
    _record_tiger(worker["company_id"], job_id, worker["_id"], body.amount, merchant["mcc"], outcome["result"])

    if outcome["result"] == "approved":
        mongo.jobs.update_one({"_id": job_id}, {"$inc": {"spent_usd": body.amount}})
        ir = mongo.intent_receipts.find_one_and_update(
            {"request_id": req["_id"]}, {"$push": {"transaction_ids": txn["_id"]}}, return_document=True
        )
        if ir is not None:
            # Re-seal so the hash covers the new transaction.
            mongo.intent_receipts.update_one({"_id": ir["_id"]}, {"$set": {"hash": agent.intent_hash(ir)}})
        messaging.send_text(
            worker["phone"],
            f"Approved ${body.amount:.2f} at {merchant['name']}. Text me a photo of the receipt.",
        )
        log_activity(
            "purchase_approved", f"{worker['name']} spent ${body.amount:.2f} at {merchant['name']}", job_id
        )
    else:
        reason = _decline_text(outcome["decline_reason"], card, req)
        mongo.workers.update_one(
            {"_id": worker["_id"]},
            {"$set": {"offer": {"job_id": job_id, "merchant": merchant["name"], "amount": body.amount}}},
        )
        messaging.send_text(
            worker["phone"],
            f"Declined at {merchant['name']}: {reason}. Reply YES to ask the owner for a card there.",
        )
        log_activity(
            "purchase_declined",
            f"{worker['name']} declined at {merchant['name']} (${body.amount:.2f}): {reason}",
            job_id,
        )

    return {"transaction_id": txn["_id"], **outcome}
