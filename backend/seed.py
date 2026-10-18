"""Seed demo data. Safe to re-run.

    cd backend && python seed.py          # upsert company, workers, jobs, merchants (+ Tiger history)
    cd backend && python seed.py --reset  # also clear this company's requests, cards, purchases, etc.

Phones come from OWNER_PHONE and WORKER_PHONE (in .env or the shell) so the
demo can use real phones. Defaults match tests/demo_path.sh.

If TIGER_DATABASE_URL is set, also writes backdated spend events to Tiger
(table spend_events, see contracts.md) whose approved amounts add up to each
job's spent_usd. Skipped if it isn't set.
"""
import os
import random
import sys
from datetime import timedelta

from db import mongo, now, reachable

DEFAULT_OWNER_PHONE = "+15550009999"
DEFAULT_WORKER_PHONE = "+15550001111"
SANDBOX_WORKER_IDS = ["w_veyzl"]  # created by /ai/audit; cleared on --reset


def company(owner_phone: str) -> dict:
    return {
        "_id": "co_ballard",
        "name": "Ballard Plumbing & Heat",
        "owner_name": "Dana",
        "owner_phone": owner_phone,
        "approval_threshold_usd": 250,
    }


def workers(worker_phone: str) -> list[dict]:
    return [
        {
            "_id": "w_mike",
            "company_id": "co_ballard",
            "name": "Mike",
            "phone": worker_phone,
            "per_purchase_limit_usd": 300,
        },
    ]


def job(_id, code, name, budget, spent, quoted, planned):
    return {
        "_id": _id,
        "company_id": "co_ballard",
        "code": code,
        "name": name,
        "aliases": [name.split()[0].lower()],
        "materials_budget_usd": budget,
        "spent_usd": spent,
        "quoted_price_usd": quoted,
        "planned_materials": planned,
        "status": "active",
    }


JOBS = [
    job(
        "job_henderson", "HEN-01", "Henderson Repipe", 2400, 1610, 7200,
        ["copper pipe 3/4", "copper elbows 3/4", "solder", "flux", "shutoff valves"],
    ),
    job("job_ortega", "ORT-01", "Ortega Water Heater", 1400, 1380, 3900, []),
    job("job_chen", "CHN-01", "Chen Bathroom", 1800, 420, 5600, []),
]

MERCHANTS = [
    {"_id": "m_ferguson", "name": "Ferguson", "mcc": "5074"},
    {"_id": "m_home_depot", "name": "Home Depot", "mcc": "5200"},
    {"_id": "m_ace", "name": "Ace Hardware", "mcc": "5251"},
]


def phones() -> tuple[str, str]:
    owner = os.getenv("OWNER_PHONE", "").strip() or DEFAULT_OWNER_PHONE
    worker = os.getenv("WORKER_PHONE", "").strip() or DEFAULT_WORKER_PHONE
    if owner == worker:
        # route_message checks the owner first, so the worker could never be reached.
        raise ValueError("OWNER_PHONE and WORKER_PHONE must be different numbers")
    return owner, worker


# ---------- MongoDB


def reset() -> None:
    worker_ids = [w["_id"] for w in workers("")] + SANDBOX_WORKER_IDS
    job_ids = [j["_id"] for j in JOBS]
    req_ids = [r["_id"] for r in mongo.requests.find({"worker_id": {"$in": worker_ids}}, {"_id": 1})]
    mongo.requests.delete_many({"_id": {"$in": req_ids}})
    mongo.approvals.delete_many({"request_id": {"$in": req_ids}})
    mongo.intent_receipts.delete_many({"request_id": {"$in": req_ids}})
    mongo.cards.delete_many({"$or": [{"worker_id": {"$in": worker_ids}}, {"request_id": {"$in": req_ids}}]})
    mongo.transactions.delete_many({"job_id": {"$in": job_ids}})
    mongo.receipts.delete_many({"job_id": {"$in": job_ids}})
    mongo.activity.delete_many({"job_id": {"$in": job_ids + [None]}})
    mongo.workers.delete_many({"_id": {"$in": SANDBOX_WORKER_IDS}})


def seed(do_reset: bool = False) -> None:
    """Seed MongoDB only (no Tiger, no output). Used by tests and /ai/audit."""
    owner_phone, worker_phone = phones()
    if do_reset:
        reset()
    mongo.companies.replace_one({"_id": "co_ballard"}, company(owner_phone), upsert=True)
    for coll, docs in [(mongo.workers, workers(worker_phone)), (mongo.jobs, JOBS), (mongo.merchants, MERCHANTS)]:
        for doc in docs:
            # A phone can belong to one worker only (e.g. DEMO_MODE may have moved it).
            if coll is mongo.workers:
                mongo.workers.update_many(
                    {"phone": doc["phone"], "_id": {"$ne": doc["_id"]}}, {"$set": {"phone": None}}
                )
            coll.replace_one({"_id": doc["_id"]}, doc, upsert=True)


# ---------- Tiger (Postgres)

TIGER_SCHEMA = """
CREATE TABLE IF NOT EXISTS spend_events (
    occurred_at TIMESTAMPTZ NOT NULL,
    company_id  TEXT NOT NULL,
    job_id      TEXT,
    worker_id   TEXT,
    amount_usd  NUMERIC(10, 2) NOT NULL,
    mcc         TEXT,
    result      TEXT NOT NULL,          -- approved | declined
    source      TEXT NOT NULL DEFAULT 'live'  -- live | seed
)
"""
# Approved purchases per job; their amounts add up to the job's spent_usd.
HISTORY = {"job_henderson": 8, "job_ortega": 6, "job_chen": 3}
DECLINES = [("job_henderson", 64.20, "5200", 6), ("job_chen", 38.75, "5812", 2)]  # (job, amount, mcc, days ago)


def build_spend_events(days: int = 28, seed_value: int = 7) -> list[tuple]:
    """Deterministic backdated history: (occurred_at, company_id, job_id, worker_id, amount, mcc, result)."""
    rng = random.Random(seed_value)
    today = now().replace(hour=0, minute=0, second=0, microsecond=0)
    events = []
    for j in JOBS:
        count = HISTORY.get(j["_id"], 0)
        total_cents = round(j["spent_usd"] * 100)
        if not count or not total_cents:
            continue
        weights = [rng.uniform(0.5, 1.5) for _ in range(count)]
        cents = [int(total_cents * w / sum(weights)) for w in weights]
        cents[-1] += total_cents - sum(cents)  # exact total
        day_offsets = sorted(rng.sample(range(1, days + 1), count), reverse=True)
        for amount_cents, ago in zip(cents, day_offsets):
            at = today - timedelta(days=ago, hours=-rng.randint(7, 16), minutes=-rng.randint(0, 59))
            mcc = "5251" if rng.random() < 0.25 else "5074"
            events.append((at, "co_ballard", j["_id"], "w_mike", amount_cents / 100, mcc, "approved"))
    for job_id, amount, mcc, ago in DECLINES:
        at = today - timedelta(days=ago, hours=-11)
        events.append((at, "co_ballard", job_id, "w_mike", amount, mcc, "declined"))
    return sorted(events)


def seed_tiger(url: str | None, do_reset: bool = False, connect=None) -> str:
    """Writes backdated spend events. Returns a one-line status. Never raises."""
    if not url:
        return "Tiger: skipped (TIGER_DATABASE_URL not set)"
    try:
        if connect is None:
            import psycopg

            connect = psycopg.connect
        events = build_spend_events()
        with connect(url, connect_timeout=10) as conn, conn.cursor() as cur:
            cur.execute(TIGER_SCHEMA)
            try:  # Tiger is TimescaleDB; a hypertable makes time-range queries fast.
                cur.execute("SAVEPOINT hyper")
                cur.execute("SELECT create_hypertable('spend_events', 'occurred_at', if_not_exists => TRUE)")
            except Exception:
                cur.execute("ROLLBACK TO SAVEPOINT hyper")
            sources = ("seed", "live") if do_reset else ("seed",)
            cur.execute(
                "DELETE FROM spend_events WHERE company_id = %s AND source = ANY(%s)", ("co_ballard", list(sources))
            )
            cur.executemany(
                "INSERT INTO spend_events (occurred_at, company_id, job_id, worker_id, amount_usd, mcc, result, source)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s, 'seed')",
                events,
            )
        approved = sum(1 for e in events if e[-1] == "approved")
        return f"Tiger: wrote {len(events)} backdated spend events ({approved} approved, {len(events) - approved} declined)"
    except Exception as e:
        return f"Tiger: FAILED ({type(e).__name__}), MongoDB seed is still done"


def main() -> int:
    do_reset = "--reset" in sys.argv
    try:
        owner_phone, worker_phone = phones()
    except ValueError as e:
        print(f"Error: {e}")
        return 1
    if not reachable():
        print("Error: MongoDB is unreachable (check MONGODB_URI and that this network allows port 27017).")
        return 1
    seed(do_reset)
    print(
        f"MongoDB: seeded Ballard Plumbing & Heat: {len(workers(''))} worker, {len(JOBS)} jobs, "
        f"{len(MERCHANTS)} merchants" + (" (reset)" if do_reset else "")
    )
    print(f"  owner Dana  {owner_phone}" + ("" if os.getenv("OWNER_PHONE") else "  (default; set OWNER_PHONE)"))
    print(f"  worker Mike {worker_phone}" + ("" if os.getenv("WORKER_PHONE") else "  (default; set WORKER_PHONE)"))
    print(seed_tiger(os.getenv("TIGER_DATABASE_URL"), do_reset))
    return 0


if __name__ == "__main__":
    sys.exit(main())
