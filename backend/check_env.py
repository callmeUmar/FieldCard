"""Check that backend/.env works: Gemini key and MongoDB connection.

    cd backend && python check_env.py

Prints PASS or FAIL for each check. Never prints secret values.
"""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))
SECRETS = [v for k in ("GEMINI_API_KEY", "MONGODB_URI") if (v := os.getenv(k))]


def clean(err: Exception) -> str:
    text = f"{type(err).__name__}: {err}"
    for secret in SECRETS:
        text = text.replace(secret, "<redacted>")
    return text[:300]


def check_gemini() -> str:
    from google import genai

    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    model = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
    client = genai.Client(api_key=key)
    reply = client.models.generate_content(model=model, contents="Reply with the word OK.")
    return f"model {model} replied {reply.text.strip()[:20]!r}"


def check_mongo() -> str:
    from pymongo import MongoClient

    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise RuntimeError("MONGODB_URI is not set")
    client = MongoClient(uri, tz_aware=True, serverSelectionTimeoutMS=8000)
    client.admin.command("ping")
    db = client["fieldcard"]
    counts = {name: db[name].estimated_document_count() for name in sorted(db.list_collection_names())}
    return f"ping ok, fieldcard collections: {counts or 'none yet'}"


ok = True
for name, check in [("Gemini", check_gemini), ("MongoDB", check_mongo)]:
    try:
        print(f"PASS {name}: {check()}")
    except Exception as e:
        ok = False
        print(f"FAIL {name}: {clean(e)}")
sys.exit(0 if ok else 1)
