"""TEMPORARY dev seed until Raimbek's seed.py lands. Safe to re-run.

    cd backend && python seed_dev.py          # upsert company, worker, jobs, merchants
    cd backend && python seed_dev.py --reset  # also clear w_mike's requests, cards, purchases, etc.

Phones match tests/demo_path.sh defaults.
"""
import sys

from db import mongo

COMPANY = {
    "_id": "co_ballard",
    "name": "Ballard Plumbing & Heat",
    "owner_name": "Dana",
    "owner_phone": "+15550009999",
    "approval_threshold_usd": 250,
}

WORKERS = [
    {
        "_id": "w_mike",
        "company_id": "co_ballard",
        "name": "Mike",
        "phone": "+15550001111",
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


def reset() -> None:
    worker_ids = [w["_id"] for w in WORKERS]
    job_ids = [j["_id"] for j in JOBS]
    req_ids = [r["_id"] for r in mongo.requests.find({"worker_id": {"$in": worker_ids}}, {"_id": 1})]
    mongo.requests.delete_many({"_id": {"$in": req_ids}})
    mongo.approvals.delete_many({"request_id": {"$in": req_ids}})
    mongo.intent_receipts.delete_many({"request_id": {"$in": req_ids}})
    mongo.cards.delete_many({"$or": [{"worker_id": {"$in": worker_ids}}, {"request_id": {"$in": req_ids}}]})
    mongo.transactions.delete_many({"job_id": {"$in": job_ids}})
    mongo.receipts.delete_many({"job_id": {"$in": job_ids}})
    mongo.activity.delete_many({"job_id": {"$in": job_ids + [None]}})


def seed(do_reset: bool = False) -> None:
    if do_reset:
        reset()
    mongo.companies.replace_one({"_id": COMPANY["_id"]}, COMPANY, upsert=True)
    for coll, docs in [(mongo.workers, WORKERS), (mongo.jobs, JOBS), (mongo.merchants, MERCHANTS)]:
        for doc in docs:
            coll.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    print(f"Seeded {COMPANY['name']}: {len(WORKERS)} worker, {len(JOBS)} jobs, {len(MERCHANTS)} merchants"
          + (" (reset)" if do_reset else ""))


if __name__ == "__main__":
    seed(do_reset="--reset" in sys.argv)
