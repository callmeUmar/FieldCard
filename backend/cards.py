# TEMPORARY: minimal mock so agent.py can run. Muhammad will replace this file
# with the real card provider. Keep the interface in contracts.md.
import os
import random
from datetime import timedelta

from db import mongo, new_id, now


class MockProvider:
    def create_card(self, request_id: str, mccs: list[str], amount_cap: float, hours: int) -> dict:
        card = {
            "_id": new_id("card"),
            "request_id": request_id,
            "worker_id": None,
            "last4": f"{random.randint(0, 9999):04d}",
            "allowed_mccs": list(mccs),
            "amount_cap_usd": round(amount_cap, 2),
            "expires_at": now() + timedelta(hours=hours),
            "state": "active",
        }
        mongo.cards.insert_one(card)
        return card

    def simulate_purchase(self, card_id: str, merchant_name: str, mcc: str, amount: float) -> dict:
        card = mongo.cards.find_one({"_id": card_id})
        if card is None:
            return {"result": "declined", "decline_reason": "card_not_found"}
        if card["state"] != "active":
            return {"result": "declined", "decline_reason": f"card_{card['state']}"}
        if card["expires_at"] <= now():
            mongo.cards.update_one({"_id": card_id}, {"$set": {"state": "expired"}})
            return {"result": "declined", "decline_reason": "card_expired"}
        if mcc not in card["allowed_mccs"]:
            return {"result": "declined", "decline_reason": "merchant_category_not_allowed"}
        if amount > card["amount_cap_usd"]:
            return {"result": "declined", "decline_reason": "over_amount_cap"}
        mongo.cards.update_one({"_id": card_id}, {"$set": {"state": "used"}})
        return {"result": "approved", "decline_reason": None}

    def terminate_card(self, card_id: str) -> None:
        mongo.cards.update_one({"_id": card_id}, {"$set": {"state": "terminated"}})


def get_provider() -> MockProvider:
    name = os.getenv("CARD_PROVIDER", "mock")
    if name != "mock":
        raise NotImplementedError(f"CARD_PROVIDER={name} is not implemented yet")
    return MockProvider()
