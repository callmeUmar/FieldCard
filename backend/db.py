import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).with_name(".env"))

# MongoClient connects lazily, so importing this module never touches the network.
mongo = MongoClient(os.getenv("MONGODB_URI"), tz_aware=True)["fieldcard"]


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def log_activity(kind: str, message: str, job_id: str | None = None) -> dict:
    doc = {"_id": new_id("act"), "at": now(), "kind": kind, "message": message, "job_id": job_id}
    mongo.activity.insert_one(doc)
    return doc


def _exact_ci(value: str) -> dict:
    return {"$regex": f"^{re.escape(value)}$", "$options": "i"}


def find_merchant(name: str) -> dict | None:
    if not name or not name.strip():
        return None
    return mongo.merchants.find_one({"name": _exact_ci(name.strip())})


def match_job(company_id: str, query: str) -> dict:
    query = (query or "").strip()
    if not query:
        return {"job_id": None, "candidates": []}

    hits = list(
        mongo.jobs.find(
            {
                "company_id": company_id,
                "status": "active",
                "$or": [
                    {"name": {"$regex": re.escape(query), "$options": "i"}},
                    {"code": _exact_ci(query)},
                    {"aliases": _exact_ci(query)},
                ],
            }
        ).limit(4)
    )

    if len(hits) == 1:
        job = hits[0]
        remaining = job.get("materials_budget_usd", 0) - job.get("spent_usd", 0)
        return {"job_id": job["_id"], "name": job["name"], "remaining_usd": remaining}

    return {
        "job_id": None,
        "candidates": [{"job_id": j["_id"], "name": j["name"]} for j in hits[:3]],
    }
