import hashlib
import json
import os
from dataclasses import asdict
from pathlib import Path

from google import genai
from google.genai import types

import cards
import db
import messaging
import policy
import vision
from db import log_activity, mongo, new_id, now

CARD_HOURS = 4
CAP_MULTIPLIER = 1.25
YES_WORDS = {"YES", "Y", "OK", "APPROVE"}
NO_WORDS = {"NO", "N", "DENY"}

# Created only when a key is set, so this module imports without one (tests, main.py).
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY")) if os.getenv("GEMINI_API_KEY") else None
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
SYSTEM_PROMPT = Path(__file__).with_name("system_prompt.txt").read_text()
provider = cards.get_provider()

# One chat per worker phone, so the agent remembers the conversation.
chats: dict[str, object] = {}


def handle_worker_message(worker: dict, text: str, image_url: str | None = None) -> str:
    if client is None:
        raise RuntimeError("GEMINI_API_KEY is not set")
    company = mongo.companies.find_one({"_id": worker["company_id"]})

    # Tools are closures over this worker and this message, so the model
    # cannot pick a different worker or image.
    def match_job(query: str) -> dict:
        """Find the job the worker means.

        Args:
            query: Job name, code or nickname as the worker said it.

        Returns:
            {"job_id", "name", "remaining_usd"} on a single match, otherwise
            {"job_id": None, "candidates": [{"job_id", "name"}]}.
        """
        return db.match_job(worker["company_id"], query)

    def request_card(job_id: str, merchant_name: str, items: str, est_amount_usd: float) -> dict:
        """Request a single-use card for a purchase. Policy decides the outcome.

        Args:
            job_id: The job_id returned by match_job.
            merchant_name: The store name, e.g. "Ferguson".
            items: Short description of what is being bought.
            est_amount_usd: Estimated total in US dollars.

        Returns:
            {"status": "issued", "last4", "cap_usd", "store", "expires_in_hours"},
            {"status": "waiting_for_owner", "owner", "reasons"} or
            {"status": "denied", "reasons"}.
        """
        return request_card_flow(worker, company, job_id, merchant_name, items, est_amount_usd, text)

    def read_receipt(job_id: str) -> dict:
        """Read the receipt photo the worker just sent and check it against the job plan.

        Args:
            job_id: The job_id returned by match_job.

        Returns:
            The receipt with store, items, total and flags (items not in the plan).
        """
        if not image_url:
            return {"error": "No photo was attached to this message."}
        try:
            return receipt_flow(worker, job_id, image_url)
        except NotImplementedError:
            return {"error": "Receipt reading is not available yet."}

    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT.replace("{company_name}", company["name"]),
        temperature=0.2,
        tools=[match_job, request_card, read_receipt],
    )

    phone = worker["phone"]
    if phone not in chats:
        chats[phone] = client.chats.create(model=MODEL)

    message = text or "I sent a receipt photo."
    if text and image_url:
        message += "\n[Photo attached]"
    reply = chats[phone].send_message(message, config=config)
    return reply.text


def request_card_flow(worker, company, job_id, merchant_name, items, est, original_text) -> dict:
    merchant = db.find_merchant(merchant_name)
    if merchant is None:
        return {"status": "denied", "reasons": [f"{merchant_name} is not a known store."]}

    job = mongo.jobs.find_one({"_id": job_id})
    active_cards = list(
        mongo.cards.find({"worker_id": worker["_id"], "state": "active", "expires_at": {"$gt": now()}})
    )
    result = policy.check_policy(job, worker, company, est, merchant["mcc"], active_cards)

    if result.allowed:
        status = "approved"
    elif result.needs_owner:
        status = "waiting_for_owner"
    else:
        status = "denied"

    req_id = new_id("req")
    mongo.requests.insert_one(
        {
            "_id": req_id,
            "worker_id": worker["_id"],
            "job_id": job_id,
            "merchant": merchant["name"],
            "mcc": merchant["mcc"],
            "items": items,
            "est_amount_usd": est,
            "original_text": original_text,
            "policy": asdict(result),
            "status": status,
            "created_at": now(),
        }
    )
    log_activity(
        "request",
        f"{worker['name']} requested ${est:.2f} at {merchant['name']} ({status})",
        job_id if job else None,
    )

    if result.allowed:
        card = issue_card(req_id)
        return {
            "status": "issued",
            "last4": card["last4"],
            "cap_usd": card["amount_cap_usd"],
            "store": merchant["name"],
            "expires_in_hours": CARD_HOURS,
        }
    if result.needs_owner:
        ask_owner(req_id, company, worker, result.reasons)
        return {"status": "waiting_for_owner", "owner": company["owner_name"], "reasons": result.reasons}
    return {"status": "denied", "reasons": result.reasons}


def issue_card(req_id: str) -> dict:
    req = mongo.requests.find_one({"_id": req_id})
    job = mongo.jobs.find_one({"_id": req["job_id"]})

    cap = round(req["est_amount_usd"] * CAP_MULTIPLIER, 2)
    owner_approved = mongo.approvals.find_one({"request_id": req_id, "status": "approved"}) is not None
    if not owner_approved:
        remaining = job["materials_budget_usd"] - job.get("spent_usd", 0)
        cap = min(cap, remaining)

    card = provider.create_card(req_id, [req["mcc"]], cap, CARD_HOURS)
    mongo.cards.update_one({"_id": card["_id"]}, {"$set": {"worker_id": req["worker_id"]}})
    card["worker_id"] = req["worker_id"]
    mongo.requests.update_one({"_id": req_id}, {"$set": {"status": "issued", "card_id": card["_id"]}})

    write_intent_receipt(req_id, card)
    log_activity(
        "card_issued",
        f"Card ending {card['last4']} issued: ${card['amount_cap_usd']:.2f} cap at {req['merchant']}, {CARD_HOURS}h",
        req["job_id"],
    )
    return card


def ask_owner(req_id: str, company: dict, worker: dict, reasons: list[str]) -> None:
    req = mongo.requests.find_one({"_id": req_id})
    mongo.approvals.insert_one(
        {
            "_id": new_id("appr"),
            "request_id": req_id,
            "owner_phone": company["owner_phone"],
            "status": "pending",
            "created_at": now(),
            "decided_at": None,
        }
    )
    why = "; ".join(r.rstrip(".") for r in reasons)
    messaging.send_text(
        company["owner_phone"],
        f"Fieldcard: {worker['name']} wants ${req['est_amount_usd']:.2f} at {req['merchant']} ({why}). "
        "Reply YES or NO.",
    )
    log_activity("approval_requested", f"Owner asked to approve {worker['name']}: {why}", req["job_id"])


def handle_owner_message(company: dict, text: str) -> str:
    approval = mongo.approvals.find_one(
        {"owner_phone": company["owner_phone"], "status": "pending"}, sort=[("created_at", -1)]
    )
    if approval is None:
        return "Fieldcard: no requests are waiting for you."

    answer = (text or "").strip().strip(".!").upper()
    if answer in YES_WORDS:
        decision = "approved"
    elif answer in NO_WORDS:
        decision = "denied"
    else:
        return "Reply YES or NO."

    # Only the first reply wins if the owner texts twice.
    updated = mongo.approvals.update_one(
        {"_id": approval["_id"], "status": "pending"},
        {"$set": {"status": decision, "decided_at": now()}},
    )
    if updated.modified_count == 0:
        return "Fieldcard: that request was already decided."

    req = mongo.requests.find_one({"_id": approval["request_id"]})
    worker = mongo.workers.find_one({"_id": req["worker_id"]})

    if decision == "approved":
        mongo.requests.update_one({"_id": req["_id"]}, {"$set": {"status": "approved"}})
        log_activity("approval_decided", f"{company['owner_name']} approved {worker['name']}'s request", req["job_id"])
        card = issue_card(req["_id"])
        messaging.send_text(
            worker["phone"],
            f"Fieldcard: {company['owner_name']} approved. Card ending {card['last4']}, "
            f"cap ${card['amount_cap_usd']:.2f}, {req['merchant']} only, expires in {CARD_HOURS} hours.",
        )
        return f"Approved. Card ending {card['last4']} sent to {worker['name']}."

    mongo.requests.update_one({"_id": req["_id"]}, {"$set": {"status": "denied"}})
    log_activity("approval_decided", f"{company['owner_name']} denied {worker['name']}'s request", req["job_id"])
    messaging.send_text(
        worker["phone"],
        f"Fieldcard: {company['owner_name']} declined your ${req['est_amount_usd']:.2f} request at {req['merchant']}.",
    )
    return f"Denied. {worker['name']} has been told."


def intent_hash(record: dict) -> str:
    body = {k: v for k, v in record.items() if k != "hash"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()


def write_intent_receipt(req_id: str, card: dict) -> dict:
    req = mongo.requests.find_one({"_id": req_id})
    # Re-read from Mongo so datetimes have the same (millisecond) precision
    # they will have when the hash is checked later.
    card = mongo.cards.find_one({"_id": card["_id"]})
    approvals = list(mongo.approvals.find({"request_id": req_id}, sort=[("created_at", 1)]))

    record = {
        "_id": f"ir_{req_id}",
        "request_id": req_id,
        "original_text": req["original_text"],
        "interpretation": {
            "worker_id": req["worker_id"],
            "job_id": req["job_id"],
            "merchant": req["merchant"],
            "mcc": req["mcc"],
            "items": req["items"],
            "est_amount_usd": req["est_amount_usd"],
        },
        "policy": req["policy"],
        "approvals": [
            {k: a.get(k) for k in ("_id", "owner_phone", "status", "created_at", "decided_at")}
            for a in approvals
        ],
        "card_rules": {
            "card_id": card["_id"],
            "last4": card["last4"],
            "allowed_mccs": card["allowed_mccs"],
            "amount_cap_usd": card["amount_cap_usd"],
            "expires_at": card["expires_at"],
            "single_use": True,
        },
        "transaction_ids": [],
    }
    record["hash"] = intent_hash(record)
    mongo.intent_receipts.replace_one({"_id": record["_id"]}, record, upsert=True)
    return record


def receipt_flow(worker: dict, job_id: str, image_url: str) -> dict:
    job = mongo.jobs.find_one({"_id": job_id, "company_id": worker["company_id"]})
    if job is None:
        return {"error": "Unknown job."}

    result = vision.read_receipt(image_url, job.get("planned_materials", []))

    # Link to this worker's latest approved purchase on the job.
    card_ids = [c["_id"] for c in mongo.cards.find({"worker_id": worker["_id"]}, {"_id": 1})]
    txn = mongo.transactions.find_one(
        {"job_id": job_id, "result": "approved", "card_id": {"$in": card_ids}},
        sort=[("occurred_at", -1)],
    )

    receipt = {
        "_id": new_id("rcpt"),
        "transaction_id": txn["_id"] if txn else None,
        "job_id": job_id,
        "store": result.get("store"),
        "items": result.get("items", []),
        "total": result.get("total"),
        "flags": result.get("flags", []),
        "ocr_source": result.get("ocr_source"),
    }
    mongo.receipts.insert_one(receipt)

    flags = receipt["flags"]
    if flags:
        message = f"Receipt from {receipt['store']}: flagged {', '.join(map(str, flags))}"
    else:
        message = f"Receipt from {receipt['store']}: all items match the plan"
    log_activity("receipt", message, job_id)

    return {**result, "receipt_id": receipt["_id"], "transaction_id": receipt["transaction_id"]}
