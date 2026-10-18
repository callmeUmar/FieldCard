"""Spending policy. Pure code: the AI never decides whether spending is allowed."""

import math
from dataclasses import dataclass, field

# Plumbing supply, hardware stores, electrical parts.
PRE_APPROVED_MCCS = {"5074", "5251", "5065"}


@dataclass
class PolicyResult:
    allowed: bool
    needs_owner: bool
    reasons: list[str] = field(default_factory=list)


def _denied(reason: str) -> PolicyResult:
    return PolicyResult(allowed=False, needs_owner=False, reasons=[reason])


def check_policy(
    job: dict | None,
    worker: dict,
    company: dict,
    est_amount: float,
    mcc: str,
    active_cards: list[dict],
) -> PolicyResult:
    # Hard denials: the owner cannot approve these.
    if job is None:
        return _denied("No matching job found.")
    if job.get("status") != "active":
        return _denied(f"Job {job.get('name', job['_id'])} is not active.")
    if job.get("company_id") != company["_id"]:
        return _denied("Job belongs to a different company.")
    if any(
        c.get("worker_id") == worker["_id"] and c.get("state") == "active"
        for c in active_cards
    ):
        return _denied(
            f"{worker.get('name', 'Worker')} already has an active card. "
            "Use or cancel it before requesting another."
        )

    # NaN compares false against every limit and would slip through all of them.
    if not isinstance(est_amount, (int, float)) or not math.isfinite(est_amount) or est_amount <= 0:
        return _denied("The amount must be a positive dollar amount.")

    # Soft limits: the owner can approve these.
    reasons = []
    remaining = job.get("materials_budget_usd", 0) - job.get("spent_usd", 0)
    if est_amount > remaining:
        reasons.append(
            f"${est_amount:.2f} is over the job's remaining materials budget of ${remaining:.2f}."
        )
    limit = worker.get("per_purchase_limit_usd", 0)
    if est_amount > limit:
        reasons.append(f"${est_amount:.2f} is over the worker's per-purchase limit of ${limit:.2f}.")
    threshold = company.get("approval_threshold_usd", 0)
    if est_amount > threshold:
        reasons.append(
            f"${est_amount:.2f} is over the company's approval threshold of ${threshold:.2f}."
        )
    if mcc not in PRE_APPROVED_MCCS:
        reasons.append(f"Merchant category {mcc} is not pre-approved.")

    if not reasons:
        return PolicyResult(allowed=True, needs_owner=False, reasons=[])
    return PolicyResult(allowed=False, needs_owner=True, reasons=reasons)
