"""POST /webhooks/photon: inbound texts reach the owner flow / Gemini agent and the reply is texted back."""
import pytest
from fastapi.testclient import TestClient

import agent
import main
import messaging
import seed
from db import mongo

client = TestClient(main.app)
MIKE = "+15550001111"
DANA = "+15550009999"


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    for name in mongo.list_collection_names():
        mongo.drop_collection(name)
    seed.seed()
    messaging.DEV_OUTBOX.clear()
    monkeypatch.delenv("PHOTON_WEBHOOK_TOKEN", raising=False)
    calls = []

    def fake_agent(worker, text, image_url=None, model=None):  # stands in for Gemini
        calls.append((worker["_id"], text, image_url))
        return f"agent saw: {text}"

    monkeypatch.setattr(agent, "handle_worker_message", fake_agent)
    return calls


def texts_to(phone):
    return [m["text"] for m in messaging.DEV_OUTBOX if m["to"] == phone]


def post(payload, **kw):
    r = client.post("/webhooks/photon", json=payload, **kw)
    return r.status_code, r.json()


def test_flat_payload_reaches_the_agent_and_reply_is_texted_back(fresh):
    assert post({"from": MIKE, "text": "Elbows at Ferguson, $160", "id": "m1"}) == (200, {"status": "accepted"})
    assert fresh == [("w_mike", "Elbows at Ferguson, $160", None)]
    assert texts_to(MIKE) == ["agent saw: Elbows at Ferguson, $160"]


def test_spectrum_shaped_message(fresh):
    payload = {
        "message": {
            "id": "sp1",
            "direction": "inbound",
            "platform": "imessage",
            "content": {"type": "text", "text": "need pex for henderson"},
            "sender": {"id": "+1 (555) 000-1111"},
            "space": {"id": "space_1"},
        }
    }
    assert post(payload)[1] == {"status": "accepted"}
    assert fresh == [("w_mike", "need pex for henderson", None)]  # formatted number matched Mike


def test_photo_reaches_the_agent_as_image_url(fresh):
    post({"sender": MIKE, "body": "", "mediaUrl": ["https://example.com/r.jpg"], "id": "m2"})
    assert fresh == [("w_mike", "", "https://example.com/r.jpg")]


@pytest.mark.parametrize("payload", [
    {"message": {"id": "o1", "direction": "outbound", "content": {"type": "text", "text": "hi"}, "sender": {"id": MIKE}}},
    {"message": {"id": "t1", "direction": "inbound", "content": {"type": "typing", "state": "start"}, "sender": {"id": MIKE}}},
    {"text": "no sender"},
    {"event": "delivery.status"},
])
def test_non_messages_are_ignored(fresh, payload):
    assert post(payload)[1] == {"status": "ignored"}
    assert fresh == [] and messaging.DEV_OUTBOX == []


def test_retried_delivery_is_handled_once(fresh):
    body = {"from": MIKE, "text": "hello", "id": "dup1"}
    assert post(body)[1] == {"status": "accepted"}
    assert post(body)[1] == {"status": "duplicate"}
    assert len(fresh) == 1 and len(texts_to(MIKE)) == 1


def test_owner_yes_goes_to_the_owner_flow_not_gemini(fresh):
    worker = mongo.workers.find_one({"_id": "w_mike"})
    company = mongo.companies.find_one({"_id": "co_ballard"})
    agent.request_card_flow(worker, company, "job_henderson", "Home Depot", "cutter", 60, "t")  # needs owner
    messaging.DEV_OUTBOX.clear()

    post({"from": DANA, "text": "YES", "id": "o2"})

    assert fresh == []  # no Gemini call
    assert mongo.cards.count_documents({"worker_id": "w_mike", "state": "active"}) == 1
    assert texts_to(DANA) == ["Approved. Card ending " + mongo.cards.find_one()["last4"] + " sent to Mike."]


def test_unknown_number_gets_not_registered(fresh, monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "0")
    post({"from": "+12065550100", "text": "hi", "id": "u1"})
    assert texts_to("+12065550100") == ["This number isn't registered with Fieldcard."]


def test_agent_error_still_replies(fresh, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("gemini down")

    monkeypatch.setattr(agent, "handle_worker_message", boom)
    post({"from": MIKE, "text": "hi", "id": "e1"})
    assert texts_to(MIKE) == ["Fieldcard hit a problem with that message. Please try again in a minute."]


def test_token_required_when_configured(fresh, monkeypatch):
    monkeypatch.setenv("PHOTON_WEBHOOK_TOKEN", "s3cret")
    assert post({"from": DANA, "text": "YES", "id": "x1"})[0] == 401
    assert post({"from": MIKE, "text": "hi", "id": "x2"}, params={"token": "s3cret"})[1] == {"status": "accepted"}


def test_get_handshake_still_works():
    r = client.get("/webhooks/photon")
    assert r.status_code == 200 and r.json()["status"] == "ok"


# ---------- Photon 2.0 (the real iMessage format, per https://api.photon.codes/openapi.json)

LINE = "pho_usr_0aaaaaaaaaaaaaaaaaaaaaaaaa"
SPACE = "pho_spc_0bbbbbbbbbbbbbbbbbbbbbbbbb"
PROJECT = "pho_prj_0ccccccccccccccccccccccccc"


def photon_event(text, *, msg_id="pho_msg_0ddddddddddddddddddddddddd", event_type="message.received",
                 status="received", handle="+15550001111", content=None):
    return {
        "id": "pho_evt_0eeeeeeeeeeeeeeeeeeeeeeeee",
        "type": event_type,
        "apiVersion": "2026-07-01",
        "source": "imessage.photon",
        "timestamp": "2026-10-18T15:00:00Z",
        "data": {
            "projectId": PROJECT,
            "object": {
                "id": msg_id,
                "platform": "imessage",
                "status": status,
                "projectId": PROJECT,
                "sentBy": {"id": "pho_usr_0fffffffffffffffffffffffff", "handle": handle, "platform": "imessage", "kind": "person"},
                "receivedBy": {"id": LINE, "handle": "+18885550000", "platform": "imessage", "kind": "line"},
                "space": {"id": SPACE, "platform": "imessage", "kind": "direct", "participantIds": []},
                "content": content or {"type": "text", "format": "plain", "text": text},
            },
        },
    }


class FakeResponse:
    def __init__(self, status_code=202, text='{"id": "pho_msg_0sent"}'):
        self.status_code, self.text = status_code, text


@pytest.fixture
def photon_api(monkeypatch):
    """Real sending path (MESSAGING=photon) with Photon's HTTP API stubbed."""
    sent = []
    monkeypatch.setenv("MESSAGING", "photon")
    monkeypatch.setenv("PHOTON_API_KEY", "pho_sk_test")
    monkeypatch.setattr(messaging.requests, "post", lambda url, headers, json, timeout: sent.append((url, headers, json)) or FakeResponse())
    return sent


def test_imessage_text_reaches_gemini_and_reply_goes_back_into_the_conversation(fresh, photon_api):
    assert post(photon_event("Elbows at Ferguson, $160"))[1] == {"status": "accepted"}
    assert fresh == [("w_mike", "Elbows at Ferguson, $160", None)]
    assert photon_api == [(
        f"https://api.photon.codes/v1/projects/{PROJECT}/messages",
        {"Authorization": "Bearer pho_sk_test"},
        {"senderId": LINE, "spaceId": SPACE, "content": {"type": "text", "format": "plain", "text": "agent saw: Elbows at Ferguson, $160"}},
    )]


def test_conversation_is_remembered_for_later_messages(fresh, photon_api):
    post(photon_event("hi"))
    photon_api.clear()
    messaging.send_text("(555) 000-1111", "Card ...1234 works at Ferguson up to $200.00 for 4 hours.")
    assert [b["spaceId"] for _, _, b in photon_api] == [SPACE]  # matched by digits, sent into Mike's conversation


@pytest.mark.parametrize("event_type,status", [
    ("message.dispatched", "dispatched"),
    ("message.delivered", "delivered"),
    ("message.failed", "failed"),
    ("message.received", "delivered"),  # defensive: a non-received object
])
def test_lifecycle_events_for_our_own_replies_are_ignored(fresh, photon_api, event_type, status):
    assert post(photon_event("agent saw: hi", event_type=event_type, status=status))[1] == {"status": "ignored"}
    assert fresh == [] and photon_api == []  # no loop: our reply is never treated as a new text


def test_typing_updates_are_ignored(fresh, photon_api):
    assert post(photon_event("", content={"type": "space.typing.update", "typing": True}))[1] == {"status": "ignored"}
    assert fresh == []


def test_cannot_message_someone_who_never_texted_the_line(fresh, photon_api):
    assert messaging.photon_send("+15550009999", "approve?") is False
    assert photon_api == []


def test_photon_retry_of_the_same_message_is_handled_once(fresh, photon_api):
    post(photon_event("hello", msg_id="pho_msg_0rrrrrrrrrrrrrrrrrrrrrrrrr"))
    assert post(photon_event("hello", msg_id="pho_msg_0rrrrrrrrrrrrrrrrrrrrrrrrr"))[1] == {"status": "duplicate"}
    assert len(fresh) == 1 and len(photon_api) == 1
