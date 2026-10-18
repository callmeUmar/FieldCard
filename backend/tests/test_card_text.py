"""The card details are texted from code when a card is issued, not relayed by Gemini."""
import pytest
from google.genai import errors

import agent
import messaging
import seed_dev
from db import mongo

MIKE = "+15550001111"
DANA = "+15550009999"
CARD_TEXT_START = "Card ..."


class FakeChat:
    """Stands in for a Gemini chat: optionally calls request_card like automatic
    function calling would, then replies or fails."""

    def __init__(self, request=None, fail=False):
        self.request = request
        self.fail = fail

    def send_message(self, message, config=None):
        if self.request:
            request_card = next(t for t in config.tools if t.__name__ == "request_card")
            request_card(**self.request)
        if self.fail:
            raise errors.ServerError(503, {"error": {"code": 503, "message": "overloaded", "status": "UNAVAILABLE"}})

        class Reply:
            text = "Card sent. Text me a photo of the receipt after."

        return Reply()


FERGUSON_160 = {"job_id": "job_henderson", "merchant_name": "Ferguson", "items": "copper elbows", "est_amount_usd": 160}


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch):
    for name in mongo.list_collection_names():
        mongo.drop_collection(name)
    seed_dev.seed()
    messaging.DEV_OUTBOX.clear()
    agent.chats.clear()
    monkeypatch.setattr(agent, "client", object())  # no real Gemini client needed


def mike():
    return mongo.workers.find_one({"_id": "w_mike"})


def texts_to(phone):
    return [m["text"] for m in messaging.DEV_OUTBOX if m["to"] == phone]


def test_issued_card_is_texted_from_code():
    agent.chats[MIKE] = FakeChat(request=FERGUSON_160)

    reply = agent.handle_worker_message(mike(), "need elbows at Ferguson for Henderson, about $160")

    card = mongo.cards.find_one({"worker_id": "w_mike"})
    assert texts_to(MIKE) == [f"Card ...{card['last4']} works at Ferguson up to $200.00 for 4 hours."]
    assert reply == "Card sent. Text me a photo of the receipt after."


def test_tool_result_does_not_give_gemini_the_card_details():
    result = agent.request_card_flow(
        mike(), mongo.companies.find_one(), "job_henderson", "Ferguson", "elbows", 160, "text"
    )
    assert result == {"status": "issued", "store": "Ferguson", "card_details_texted": True}


def test_gemini_failure_after_card_issued_sends_no_busy_message():
    agent.chats[MIKE] = FakeChat(request=FERGUSON_160, fail=True)

    reply = agent.handle_worker_message(mike(), "need elbows at Ferguson for Henderson, about $160")

    assert reply is None
    sent = texts_to(MIKE)
    assert len(sent) == 1 and sent[0].startswith(CARD_TEXT_START)
    assert agent.BUSY_REPLY not in sent


def test_gemini_failure_without_card_replies_busy():
    agent.chats[MIKE] = FakeChat(fail=True)

    assert agent.handle_worker_message(mike(), "hi") == agent.BUSY_REPLY
    assert texts_to(MIKE) == []


def test_owner_approval_texts_card_details_once():
    agent.request_card_flow(
        mike(), mongo.companies.find_one(), "job_henderson", "Home Depot", "pipe cutter", 60, "text"
    )
    messaging.DEV_OUTBOX.clear()

    agent.handle_owner_message(mongo.companies.find_one(), "YES")

    sent = texts_to(MIKE)
    assert sent[0] == "Fieldcard: Dana approved your request."
    assert [t for t in sent if t.startswith(CARD_TEXT_START)] == [sent[1]]
    assert "works at Home Depot up to $75.00 for 4 hours." in sent[1]
