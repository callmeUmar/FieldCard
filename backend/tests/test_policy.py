import pytest

from policy import PRE_APPROVED_MCCS, PolicyResult, check_policy

COMPANY = {"_id": "co_acme", "approval_threshold_usd": 500}
WORKER = {"_id": "worker_luis", "name": "Luis", "company_id": "co_acme", "per_purchase_limit_usd": 300}
PLUMBING = "5074"


def make_job(**overrides):
    job = {
        "_id": "job_henderson",
        "company_id": "co_acme",
        "name": "Henderson Bathroom",
        "materials_budget_usd": 1000,
        "spent_usd": 200,
        "status": "active",
    }
    job.update(overrides)
    return job


def run(job=None, worker=WORKER, company=COMPANY, amount=100, mcc=PLUMBING, cards=()):
    return check_policy(job, worker, company, amount, mcc, list(cards))


def assert_hard_denied(result, text):
    assert result.allowed is False
    assert result.needs_owner is False
    assert len(result.reasons) == 1
    assert text in result.reasons[0]


def test_allowed_within_all_limits():
    assert run(make_job()) == PolicyResult(allowed=True, needs_owner=False, reasons=[])


def test_amount_equal_to_every_limit_is_allowed():
    job = make_job(materials_budget_usd=500, spent_usd=200)  # remaining 300
    assert run(job, amount=300).allowed is True


@pytest.mark.parametrize("mcc", sorted(PRE_APPROVED_MCCS))
def test_each_pre_approved_mcc_is_allowed(mcc):
    assert run(make_job(), mcc=mcc).allowed is True


def test_missing_job_denied():
    assert_hard_denied(run(None), "No matching job")


def test_inactive_job_denied():
    assert_hard_denied(run(make_job(status="completed")), "not active")


def test_job_from_other_company_denied():
    assert_hard_denied(run(make_job(company_id="co_other")), "different company")


def test_worker_with_active_card_denied():
    cards = [{"_id": "card_1", "worker_id": "worker_luis", "state": "active"}]
    assert_hard_denied(run(make_job(), cards=cards), "already has an active card")


def test_other_workers_or_finished_cards_do_not_block():
    cards = [
        {"_id": "card_1", "worker_id": "worker_maria", "state": "active"},
        {"_id": "card_2", "worker_id": "worker_luis", "state": "used"},
    ]
    assert run(make_job(), cards=cards).allowed is True


def test_hard_denial_wins_over_soft_limits():
    result = run(make_job(status="completed"), amount=10_000, mcc="5999")
    assert_hard_denied(result, "not active")


def test_over_remaining_budget_needs_owner():
    job = make_job(materials_budget_usd=300, spent_usd=250)  # remaining 50
    result = run(job, amount=100)
    assert result.allowed is False
    assert result.needs_owner is True
    assert len(result.reasons) == 1
    assert "remaining materials budget of $50.00" in result.reasons[0]


def test_over_worker_limit_needs_owner():
    result = run(make_job(), amount=400)
    assert result.needs_owner is True
    assert len(result.reasons) == 1
    assert "per-purchase limit of $300.00" in result.reasons[0]


def test_over_company_threshold_needs_owner():
    worker = {**WORKER, "per_purchase_limit_usd": 1000}
    result = run(make_job(), worker=worker, amount=600)
    assert result.needs_owner is True
    assert len(result.reasons) == 1
    assert "approval threshold of $500.00" in result.reasons[0]


def test_mcc_not_pre_approved_needs_owner():
    result = run(make_job(), mcc="5812")
    assert result.needs_owner is True
    assert result.reasons == ["Merchant category 5812 is not pre-approved."]


def test_all_soft_reasons_collected():
    job = make_job(materials_budget_usd=600, spent_usd=500)  # remaining 100
    result = run(job, amount=900, mcc="5999")
    assert result.allowed is False
    assert result.needs_owner is True
    assert len(result.reasons) == 4
