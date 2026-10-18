"""Dashboard read API: read-only, masked, scoped to the company, plus CORS and the demo card endpoint."""
import pytest
from fastapi.testclient import TestClient

import agent
import main
import messaging
import seed
from db import mongo

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def fresh(monkeypatch):
    for name in mongo.list_collection_names():
        mongo.drop_collection(name)
    seed.seed()
    messaging.DEV_OUTBOX.clear()
    monkeypatch.setattr(agent.db, "reachable", lambda: True)


def issue_card(amount=60):
    worker = mongo.workers.find_one({"_id": "w_mike"})
    company = mongo.companies.find_one({"_id": "co_ballard"})
    assert agent.request_card_flow(worker, company, "job_henderson", "Ferguson", "PEX", amount, "t")["status"] == "issued"


def get(path):
    response = client.get(path)
    assert response.status_code == 200, response.text
    return response.json()


def snapshot_counts():
    return {name: mongo[name].count_documents({}) for name in mongo.list_collection_names()}


def test_reads_never_write():
    issue_card()
    before = snapshot_counts()
    for path in ["/api/overview", "/api/company", "/api/workers", "/api/merchants", "/api/jobs", "/api/jobs/job_henderson",
                 "/api/jobs/job_henderson/burn", "/api/cards", "/api/requests", "/api/approvals",
                 "/api/transactions", "/api/receipts", "/api/activity", "/api/dashboard"]:
        get(path)
    assert snapshot_counts() == before


def test_dashboard_has_everything_with_phones_masked():
    issue_card()
    d = get("/api/dashboard")
    assert d["company"]["name"] == "Ballard Plumbing & Heat"
    assert d["company"]["owner_phone"] == "•••-•••-9999"
    assert [w["phone"] for w in d["workers"]] == ["•••-•••-1111"]
    assert [j["_id"] for j in d["jobs"]] == ["job_chen", "job_henderson", "job_ortega"]
    henderson = next(j for j in d["jobs"] if j["_id"] == "job_henderson")
    assert henderson["remaining_usd"] == 790 and henderson["committed_usd"] == 75  # active $75 card
    assert d["cards"][0]["job_id"] == "job_henderson"
    assert {"activity", "transactions", "requests", "approvals", "receipts", "merchants"} <= set(d)


def test_sandbox_worker_and_its_activity_are_hidden():
    mongo.workers.insert_one({"_id": "w_veyzl", "company_id": "co_ballard", "name": "VEYZL Auditor", "phone": "sandbox:veyzl"})
    mongo.activity.insert_one({"_id": "a1", "at": main.now(), "kind": "request", "message": "VEYZL Auditor requested $60.00", "job_id": "job_henderson"})
    assert [w["_id"] for w in get("/api/workers")] == ["w_mike"]
    assert get("/api/activity") == []


def test_job_detail_and_burn():
    issue_card()
    assert client.post("/api/simulate/purchase", json={"worker_id": "w_mike", "merchant_name": "Ferguson", "amount": 60}).json()["result"] == "approved"
    job = get("/api/jobs/job_henderson")
    assert job["spent_usd"] == 1670 and len(job["transactions"]) == 1 and len(job["cards"]) == 1
    burn = get("/api/jobs/job_henderson/burn")
    assert burn["baseline_usd"] == 1610
    assert [p["spent_usd"] for p in burn["points"]] == [1610, 1670, 1670]
    assert client.get("/api/jobs/job_nope").status_code == 404
    assert client.get("/api/jobs/job_nope/burn").status_code == 404


def test_activity_since_returns_only_newer():
    issue_card()
    newest = get("/api/activity")[0]["at"]
    assert get(f"/api/activity?since={newest}") == []
    assert client.get("/api/activity?since=yesterday").status_code == 400


def test_other_companies_data_is_not_exposed():
    mongo.companies.insert_one({"_id": "co_other", "name": "Other"})
    mongo.jobs.insert_one({"_id": "job_other", "company_id": "co_other", "code": "OTH", "name": "Other job"})
    mongo.transactions.insert_one({"_id": "t_other", "job_id": "job_other", "result": "approved", "occurred_at": main.now()})
    assert "job_other" not in [j["_id"] for j in get("/api/jobs")]
    assert get("/api/transactions?job_id=job_other") == []  # falls back to own company's jobs only
    assert client.get("/api/jobs/job_other").status_code == 404


def test_503_when_database_unreachable(monkeypatch):
    monkeypatch.setattr(agent.db, "reachable", lambda: False)
    assert client.get("/api/dashboard").status_code == 503


def test_cors_allows_the_dashboard_origin():
    response = client.get("/api/merchants", headers={"Origin": "https://fieldcard.vercel.app"})
    assert response.headers["access-control-allow-origin"] == "*"
    preflight = client.options(
        "/api/simulate/purchase",
        headers={"Origin": "https://fieldcard.vercel.app", "Access-Control-Request-Method": "POST",
                 "Access-Control-Request-Headers": "content-type"},
    )
    assert preflight.status_code == 200


def test_demo_request_card_runs_real_policy_and_replaces_previous_card():
    issue_card()
    body = {"worker_id": "w_mike", "job_id": "job_henderson", "merchant_name": "Ferguson", "amount_usd": 186.5, "items": "PEX"}
    first = client.post("/api/dev/request-card", json=body).json()
    assert first["status"] == "issued"
    assert first["card"]["amount_cap_usd"] == 233.12 and first["card"]["allowed_mccs"] == ["5074"]
    assert mongo.cards.count_documents({"worker_id": "w_mike", "state": "active"}) == 1  # old card terminated
    over = client.post("/api/dev/request-card", json={**body, "amount_usd": 900}).json()
    assert over["status"] == "waiting_for_owner" and over["card"] is None  # policy still decides


def test_demo_request_card_is_dev_only(monkeypatch):
    monkeypatch.setenv("MESSAGING", "photon")
    body = {"worker_id": "w_mike", "job_id": "job_henderson", "merchant_name": "Ferguson", "amount_usd": 10}
    assert client.post("/api/dev/request-card", json=body).status_code == 404


def test_overview_numbers_and_latest_card():
    empty = get("/api/overview")
    assert empty == {"spent_usd": 3410, "budget_usd": 5600, "cards_issued_today": 0, "blocked_today": 0,
                     "tracked_today_usd": 0, "latest_card": None}
    issue_card(160)  # $200 cap
    client.post("/api/simulate/purchase", json={"worker_id": "w_mike", "merchant_name": "Home Depot", "amount": 160})
    client.post("/api/simulate/purchase", json={"worker_id": "w_mike", "merchant_name": "Ferguson", "amount": 160})
    o = get("/api/overview")
    assert (o["spent_usd"], o["cards_issued_today"], o["blocked_today"], o["tracked_today_usd"]) == (3570, 1, 1, 160)
    card = o["latest_card"]
    assert (card["merchant"], card["job_name"], card["job_code"], card["amount_cap_usd"], card["state"]) == (
        "Ferguson", "Henderson Repipe", "HEN-01", 200, "used")
    assert 3.9 <= card["hours_left"] <= 4


def test_health_gemini_reports_key_format_and_google_error(monkeypatch):
    from google.genai import errors

    class Models:
        def generate_content(self, model, contents):
            raise errors.ClientError(401, {"error": {"code": 401, "message": "API key not valid.", "status": "UNAUTHENTICATED",
                                                     "details": [{"reason": "ACCESS_TOKEN_TYPE_UNSUPPORTED"}]}})

    monkeypatch.setenv("GEMINI_API_KEY", "AQ.not-a-real-key")
    monkeypatch.setattr(agent, "client", type("C", (), {"models": Models()})())
    main._gemini_check["result"] = None
    body = get("/health/gemini")
    assert body["key_format"] == "AQ." and body["ok"] is False
    assert body["error"] == "401 UNAUTHENTICATED" and body["reason"] == "ACCESS_TOKEN_TYPE_UNSUPPORTED"
    assert "not-a-real-key" not in str(body)  # never leaks the key
