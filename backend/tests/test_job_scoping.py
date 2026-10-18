"""A worker can never act on another company's job, even by passing its id directly."""
import seed_dev
import agent
from db import mongo


def test_other_company_job_is_treated_as_missing():
    for name in mongo.list_collection_names():
        mongo.drop_collection(name)
    seed_dev.seed()
    mongo.companies.insert_one(
        {"_id": "co_larsen", "name": "Larsen", "owner_name": "Erik", "owner_phone": "+1777", "approval_threshold_usd": 1}
    )
    mongo.jobs.insert_one(
        {"_id": "job_larsen", "company_id": "co_larsen", "name": "Larsen Remodel",
         "materials_budget_usd": 100_000, "spent_usd": 0, "status": "active"}
    )
    worker = mongo.workers.find_one({"_id": "w_mike"})
    company = mongo.companies.find_one({"_id": "co_ballard"})

    result = agent.request_card_flow(worker, company, "job_larsen", "Ferguson", "PEX", 50, "text")

    assert result == {"status": "denied", "reasons": ["No matching job found."]}
    assert mongo.cards.count_documents({}) == 0
    assert mongo.activity.count_documents({"job_id": "job_larsen"}) == 0
    assert mongo.requests.count_documents({"job_id": "job_larsen"}) == 0
