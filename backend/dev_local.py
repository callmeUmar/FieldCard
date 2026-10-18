"""Run the backend locally on a seeded IN-MEMORY database (no Atlas needed).

    cd backend && ../.venv/bin/python dev_local.py            # http://localhost:8000
    cd backend && ../.venv/bin/python dev_local.py --port 8001

Seeds the demo data (seed.py) and gives Mike a $160 Ferguson card, as if he had
texted "Elbows at Ferguson, $160", so the dashboard's demo buttons work right
away. SMS stay in the dev outbox. Data is lost when it stops. For local
development only.
"""
import os
import sys

import mongomock
import pymongo

pymongo.MongoClient = mongomock.MongoClient  # before db.py is imported
os.environ.setdefault("MESSAGING", "dev")
os.environ.setdefault("CARD_PROVIDER", "mock")

import uvicorn  # noqa: E402

import agent  # noqa: E402
import main  # noqa: E402
import seed  # noqa: E402

agent.db.reachable = lambda: True  # the in-memory database is always reachable
seed.seed(do_reset=True)
worker = agent.db.mongo.workers.find_one({"_id": "w_mike"})
company = agent.db.mongo.companies.find_one({"_id": worker["company_id"]})
result = agent.request_card_flow(
    worker, company, "job_henderson", "Ferguson", "copper elbows 3/4", 160, "Elbows at Ferguson, $160"
)
print(f"Seeded in-memory data; Mike's card: {result['status']}")

port = int(sys.argv[sys.argv.index("--port") + 1]) if "--port" in sys.argv else 8000
uvicorn.run(main.app, host="127.0.0.1", port=port, log_level="info")
