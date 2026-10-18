import pytest

import seed
from db import mongo


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    for name in mongo.list_collection_names():
        mongo.drop_collection(name)
    monkeypatch.delenv("OWNER_PHONE", raising=False)
    monkeypatch.delenv("WORKER_PHONE", raising=False)


def test_seed_is_idempotent_with_default_phones():
    seed.seed()
    seed.seed()
    assert mongo.companies.find_one({"_id": "co_ballard"})["owner_phone"] == seed.DEFAULT_OWNER_PHONE
    assert mongo.workers.find_one({"_id": "w_mike"})["phone"] == seed.DEFAULT_WORKER_PHONE
    assert mongo.jobs.count_documents({}) == 3
    assert {m["name"]: m["mcc"] for m in mongo.merchants.find()} == {
        "Ferguson": "5074", "Home Depot": "5200", "Ace Hardware": "5251"
    }


def test_phones_come_from_environment(monkeypatch):
    monkeypatch.setenv("OWNER_PHONE", "+12065550100")
    monkeypatch.setenv("WORKER_PHONE", "+12065550111")
    mongo.workers.insert_one({"_id": "w_other", "phone": "+12065550111"})  # e.g. moved there by DEMO_MODE
    seed.seed()
    assert mongo.companies.find_one({"_id": "co_ballard"})["owner_phone"] == "+12065550100"
    assert mongo.workers.find_one({"_id": "w_mike"})["phone"] == "+12065550111"
    assert mongo.workers.find_one({"_id": "w_other"})["phone"] is None  # one phone, one worker


def test_same_phone_for_owner_and_worker_is_rejected(monkeypatch):
    monkeypatch.setenv("OWNER_PHONE", "+12065550100")
    monkeypatch.setenv("WORKER_PHONE", "+12065550100")
    with pytest.raises(ValueError):
        seed.seed()


def test_reset_clears_this_company_and_sandbox_only():
    seed.seed()
    mongo.requests.insert_many([{"_id": "r1", "worker_id": "w_mike"}, {"_id": "r2", "worker_id": "w_veyzl"}])
    mongo.cards.insert_one({"_id": "c1", "worker_id": "w_mike", "request_id": "r1"})
    mongo.workers.insert_one({"_id": "w_veyzl", "company_id": "co_ballard", "phone": "sandbox:veyzl"})
    mongo.requests.insert_one({"_id": "r_other", "worker_id": "w_someone_else"})
    seed.seed(do_reset=True)
    assert [r["_id"] for r in mongo.requests.find()] == ["r_other"]
    assert mongo.cards.count_documents({}) == 0
    assert mongo.workers.find_one({"_id": "w_veyzl"}) is None


def test_tiger_history_matches_job_spend():
    events = seed.build_spend_events()
    assert events == seed.build_spend_events()  # deterministic
    for job in seed.JOBS:
        approved = [e for e in events if e[2] == job["_id"] and e[-1] == "approved"]
        assert round(sum(e[4] for e in approved), 2) == job["spent_usd"]
    assert all(e[0] < seed.now() for e in events)  # all backdated
    assert sum(1 for e in events if e[-1] == "declined") == len(seed.DECLINES)


def test_tiger_skipped_without_url():
    assert "skipped" in seed.seed_tiger(None)


def test_tiger_writes_schema_and_replaces_seed_rows():
    calls = []

    class Cursor:
        def execute(self, sql, params=None):
            calls.append(("execute", " ".join(sql.split())[:40], params))

        def executemany(self, sql, rows):
            calls.append(("executemany", " ".join(sql.split())[:40], len(rows)))

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    class Conn(Cursor):
        def cursor(self):
            return Cursor()

    status = seed.seed_tiger("postgres://fake", connect=lambda url, connect_timeout: Conn())
    assert status.startswith("Tiger: wrote 19 backdated spend events")
    kinds = [c[1].split()[0] for c in calls]
    assert kinds == ["CREATE", "SAVEPOINT", "SELECT", "DELETE", "INSERT"]
    assert calls[3][2] == ("co_ballard", ["seed"])  # keeps live rows unless --reset


def test_tiger_failure_never_raises():
    def refuse(url, connect_timeout):
        raise OSError("connection refused")

    assert "FAILED" in seed.seed_tiger("postgres://fake", connect=refuse)
