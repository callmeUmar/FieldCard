# Contracts

Interfaces between modules. Change this file in a PR before changing an interface.

## Messaging

Inbound message (what webhooks hand to the agent):

```python
{"from_phone": str, "text": str, "image_url": str | None}
```

Outbound:

```python
messaging.send_text(to_phone: str, text: str) -> None
```

## CardProvider (`cards.py`)

```python
create_card(request_id: str, mccs: list[str], amount_cap: float, hours: int) -> dict
```
Returns the saved card document: `_id`, `last4`, `allowed_mccs`, `amount_cap_usd`, `expires_at`, `state`.

```python
simulate_purchase(card_id: str, merchant_name: str, mcc: str, amount: float) -> dict
```
Returns `{"result": "approved" | "declined", "decline_reason": str | None}`.

```python
terminate_card(card_id: str) -> None
```

## MongoDB

Database: `fieldcard`. All `_id` values are strings (e.g. `job_henderson`). All datetimes are timezone-aware UTC.

| Collection | Fields |
|---|---|
| `companies` | `_id`, `name`, `owner_name`, `owner_phone`, `approval_threshold_usd` |
| `workers` | `_id`, `company_id`, `name`, `phone`, `per_purchase_limit_usd`, `offer?` |
| `jobs` | `_id`, `company_id`, `code`, `name`, `aliases[]`, `materials_budget_usd`, `spent_usd`, `quoted_price_usd`, `planned_materials[]`, `status` |
| `merchants` | `_id`, `name`, `mcc` |
| `requests` | `_id`, `worker_id`, `job_id`, `merchant`, `mcc`, `items`, `est_amount_usd`, `original_text`, `policy`, `status`, `created_at` |
| `approvals` | `_id`, `request_id`, `owner_phone`, `status` (`pending` \| `approved` \| `denied`), `created_at`, `decided_at` |
| `cards` | `_id`, `request_id`, `worker_id`, `last4`, `allowed_mccs[]`, `amount_cap_usd`, `expires_at`, `state` (`active` \| `used` \| `expired` \| `terminated`) |
| `transactions` | `_id`, `card_id`, `job_id`, `merchant_name`, `mcc`, `amount_usd`, `result`, `decline_reason`, `occurred_at` |
| `receipts` | `_id`, `transaction_id`, `job_id`, `store`, `items[]`, `total`, `flags[]`, `ocr_source` |
| `intent_receipts` | `_id`, `request_id`, `original_text`, `interpretation`, `policy`, `approvals[]`, `card_rules`, `transaction_ids[]`, `hash` |
| `activity` | `_id`, `at`, `kind`, `message`, `job_id` |

## Vision (`vision.py`)

```python
read_receipt(image_url: str, planned_materials: list) -> dict
```
Returns `{"store": str, "items": list, "total": float, "flags": list, "ocr_source": str}`. `flags` lists items that are not in `planned_materials`.
