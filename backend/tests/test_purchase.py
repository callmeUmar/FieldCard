"""POST /api/simulate/purchase: provider rules, recording, texts and the decline offer."""
import sys
import types
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

import agent
import main
import messaging
import seed_dev
from db import mongo, now

client = TestClient(main.app)
MIKE = "+15550001111"


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    for name in mongo.list_collection_names():
        mongo.drop_collection(name)
    seed_dev.seed()
    messaging.DEV_OUTBOX.clear()
    events = []
    monkeypatch.setitem(sys.modules, "tiger", types.SimpleNamespace(record_spend_event=lambda *a: events.append(a)))
    return events


def issue_ferguson_card(amount=60):
    worker = mongo.workers.find_one({"_id": "w_mike"})
    company = mongo.companies.find_one({"_id": "co_ballard"})
    assert agent.request_card_flow(worker, company, "job_henderson", "Ferguson", "PEX", amount, "t")["status"] == "issued"
    messaging.DEV_OUTBOX.clear()
    return mongo.cards.find_one({"worker_id": "w_mike", "state": "active"})


def buy(merchant, amount):
    response = client.post("/api/simulate/purchase", json={"worker_id": "w_mike", "merchant_name": merchant, "amount": amount})
    assert response.status_code == 200
    return response.json()


def texts():
    return [m["text"] for m in messaging.DEV_OUTBOX if m["to"] == MIKE]


def test_approved_purchase_is_recorded_everywhere(fresh):
    card = issue_ferguson_card()
    body = buy("Ferguson", 60)

    assert body["result"] == body["status"] == "approved"
    assert body["decline_reason"] is None
    txn = mongo.transactions.find_one({"_id": body["transaction_id"]})
    assert (txn["job_id"], txn["merchant_name"], txn["mcc"], txn["amount_usd"]) == ("job_henderson", "Ferguson", "5074", 60)
    assert mongo.jobs.find_one({"_id": "job_henderson"})["spent_usd"] == 1670
    ir = mongo.intent_receipts.find_one({"request_id": card["request_id"]})
    assert ir["transaction_ids"] == [txn["_id"]]
    assert agent.intent_hash(ir) == ir["hash"]  # re-sealed
    assert mongo.cards.find_one({"_id": card["_id"]})["state"] == "used"
    assert texts() == ["Approved $60.00 at Ferguson. Text me a photo of the receipt."]
    assert fresh == [("co_ballard", "job_henderson", "w_mike", 60, "5074", "approved")]
    assert mongo.activity.find_one({"kind": "purchase_approved"})["job_id"] == "job_henderson"


def test_wrong_store_is_declined_and_offers_owner_approval(fresh):
    card = issue_ferguson_card()
    body = buy("Home Depot", 60)

    assert body["result"] == "declined"
    assert texts() == ["Declined at Home Depot: this card only works at Ferguson. Reply YES to ask the owner for a card there."]
    assert mongo.workers.find_one({"_id": "w_mike"})["offer"] == {"job_id": "job_henderson", "merchant": "Home Depot", "amount": 60}
    assert mongo.jobs.find_one({"_id": "job_henderson"})["spent_usd"] == 1610  # unchanged
    assert mongo.transactions.find_one({"_id": body["transaction_id"]})["result"] == "declined"
    assert mongo.intent_receipts.find_one({"request_id": card["request_id"]})["transaction_ids"] == []
    assert mongo.cards.find_one({"_id": card["_id"]})["state"] == "active"  # still usable at Ferguson
    assert fresh[0][-1] == "declined"
    assert mongo.activity.count_documents({"kind": "purchase_declined"}) == 1


def test_over_cap_is_declined():
    issue_ferguson_card(60)  # cap $75
    assert buy("Ferguson", 80)["result"] == "declined"
    assert mongo.jobs.find_one({"_id": "job_henderson"})["spent_usd"] == 1610


def test_expired_card_is_declined():
    card = issue_ferguson_card()
    mongo.cards.update_one({"_id": card["_id"]}, {"$set": {"expires_at": now() - timedelta(minutes=1)}})
    body = buy("Ferguson", 10)
    assert body["result"] == "declined"
    assert "expired" in body["decline_reason"]


def test_unknown_store_is_declined():
    issue_ferguson_card()
    body = buy("Bob's Electronics", 10)
    assert body["result"] == "declined"
    assert mongo.transactions.find_one({"_id": body["transaction_id"]})["merchant_name"] == "Bob's Electronics"


def test_no_active_card():
    assert buy("Ferguson", 10)["result"] == "declined"


def test_tiger_failure_never_breaks_a_purchase(monkeypatch):
    def down(*args):
        raise ConnectionError("tiger down")

    monkeypatch.setitem(sys.modules, "tiger", types.SimpleNamespace(record_spend_event=down))
    issue_ferguson_card()
    assert buy("Ferguson", 60)["result"] == "approved"
