"""Scratch script: chat with the agent as a worker from the terminal.

    cd backend
    python try_agent.py +15551234567

Commands:
    /photo <url> [text]   send a receipt photo
    /owner <reply>        reply as the owner (e.g. /owner YES)
    /quit
"""
import sys

import agent
from db import mongo

phone = sys.argv[1] if len(sys.argv) > 1 else input("Worker phone: ").strip()
worker = mongo.workers.find_one({"phone": phone})
if worker is None:
    sys.exit(f"No worker with phone {phone}")
company = mongo.companies.find_one({"_id": worker["company_id"]})
print(f"Chatting as {worker['name']} ({company['name']}). /quit to exit.\n")

while True:
    try:
        line = input("you> ").strip()
    except (EOFError, KeyboardInterrupt):
        break
    if not line:
        continue
    if line == "/quit":
        break
    if line.startswith("/owner "):
        print("fieldcard -> owner>", agent.handle_owner_message(company, line[len("/owner "):]))
        continue

    image_url = None
    if line.startswith("/photo "):
        parts = line.split(maxsplit=2)
        image_url = parts[1] if len(parts) > 1 else None
        line = parts[2] if len(parts) > 2 else ""

    print("fieldcard>", agent.handle_worker_message(worker, line, image_url))
