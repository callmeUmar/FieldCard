import os
from fastapi import APIRouter, Request, Response, status
from pymongo import MongoClient

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Initialize MongoDB Connection
MONGODB_URI = os.getenv("MONGODB_URI")

client = None
db = None

if MONGODB_URI:
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
        db = client.get_database()  # Uses default database from URI
    except Exception as e:
        print(f"MongoDB connection error: {e}")


@router.api_route("/photon", methods=["GET", "POST"])
async def photon_webhook(request: Request):
    """
    Handles Photon Webhook / Redirect requests.
    - GET: Handles Photon's URL validation handshake and query params.
    - POST: Receives incoming message events and logs them to MongoDB.
    """
    # 1. Validation Handshake (GET)
    if request.method == "GET":
        return Response(
            content='{"status": "ok", "message": "Photon webhook endpoint active"}',
            status_code=status.HTTP_200_OK,
            media_type="application/json",
        )

    # 2. Incoming Event Payload (POST)
    try:
        payload = await request.json()
    except Exception:
        body_bytes = await request.body()
        payload = {"raw_body": body_bytes.decode("utf-8", errors="ignore")}

    # Log payload to MongoDB if connection exists
    if db is not None:
        try:
            db.messaging_logs.insert_one(
                {
                    "source": "photon",
                    "payload": payload,
                    "timestamp": request.headers.get("x-request-timestamp"),
                }
            )
        except Exception as err:
            print(f"Failed to log message to MongoDB: {err}")

    return {"status": "success", "received": True, "data": payload}