import os
import random
from datetime import timedelta
from db import mongo, now, new_id

class MockProvider:
    """Simulates credit card creation and authorizations for hackathon sandbox."""
    
    def create_card(self, request_id: str, mccs: list, amount_cap: float, hours: int) -> dict:
        card = {
            "_id": new_id("card"),
            "request_id": request_id,
            "provider": "mock",
            "last4": f"{random.randint(0, 9999):04d}",
            "allowed_mccs": mccs,
            "amount_cap_usd": amount_cap,
            "expires_at": now() + timedelta(hours=hours),
            "state": "active"
        }
        mongo.cards.insert_one(card)
        return card

    def simulate_purchase(self, card_id: str, merchant_name: str, mcc: str, amount: float) -> dict:
        card = mongo.cards.find_one({"_id": card_id})
        reason = None
        
        # Safely normalize expiration date comparison against timezone offsets
        current_time = now()
        expires_at = card.get("expires_at") if card else None
        if expires_at and current_time.tzinfo and not expires_at.tzinfo:
            current_time = current_time.replace(tzinfo=None)

        if not card or card.get("state") != "active":
            reason = "card is not active"
        elif expires_at and expires_at < current_time:
            reason = "card has expired"
        elif mcc not in card.get("allowed_mccs", []):
            reason = "this card only works at the approved store type"
        elif amount > card["amount_cap_usd"]:
            reason = f"over the ${card['amount_cap_usd']:.0f} limit"

        if reason is None:
            mongo.cards.update_one({"_id": card_id}, {"$set": {"state": "used"}})
            return {"result": "approved", "decline_reason": None}
            
        return {"result": "declined", "decline_reason": reason}

    def terminate_card(self, card_id: str) -> None:
        mongo.cards.update_one({"_id": card_id}, {"$set": {"state": "terminated"}})

def get_provider():
    name = os.environ.get("CARD_PROVIDER", "mock")
    if name == "mock":
        return MockProvider()
    raise NotImplementedError(f"Card provider {name} not implemented yet")