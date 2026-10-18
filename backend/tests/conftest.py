import mongomock
import pymongo

# Use an in-memory MongoDB for every test. This must run before db.py is imported.
pymongo.MongoClient = mongomock.MongoClient

import os  # noqa: E402

# send_text sends real SMS unless MESSAGING=dev; tests must never call Photon.
os.environ.setdefault("MESSAGING", "dev")
