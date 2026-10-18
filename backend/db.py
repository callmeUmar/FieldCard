import contextvars
import os
import re
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).with_name(".env"))

# MongoClient connects lazily, so importing this module never touches the network.
_atlas = MongoClient(os.getenv("MONGODB_URI"), tz_aware=True)["fieldcard"]
_memory = None
_use_memory = contextvars.ContextVar("use_memory", default=False)


def _current():
    global _memory
    if not _use_memory.get():
        return _atlas
    if _memory is None:
        import mongomock

        _memory = mongomock.MongoClient(tz_aware=True)["fieldcard"]
    return _memory


class _Database:
    """Forwards to the real database, or to an in-memory one inside in_memory().
    Every module does `from db import mongo`, so switching happens here."""

    def __getattr__(self, name):
        return getattr(_current(), name)

    def __getitem__(self, name):
        return _current()[name]


mongo = _Database()


@contextmanager
def in_memory():
    """Use the in-memory database for the current request/thread only."""
    token = _use_memory.set(True)
    try:
        yield
    finally:
        _use_memory.reset(token)


_reachable = {"ok": None, "at": 0.0}


def reachable(ttl_s: float = 30) -> bool:
    """Quick, cached MongoDB ping (1.5s timeout) so callers can fall back."""
    if _reachable["ok"] is None or time.monotonic() - _reachable["at"] > ttl_s:
        try:
            MongoClient(os.getenv("MONGODB_URI"), serverSelectionTimeoutMS=1500).admin.command("ping")
            _reachable["ok"] = True
        except Exception:
            _reachable["ok"] = False
        _reachable["at"] = time.monotonic()
    return _reachable["ok"]


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
