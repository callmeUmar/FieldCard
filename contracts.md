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

## Tiger (`TIGER_DATABASE_URL`)

Postgres/TimescaleDB table written by `seed.py` (backdated history, `source = 'seed'`) and by `tiger.record_spend_event(company_id, job_id, worker_id, amount, mcc, result)` (`source = 'live'`):

```sql
spend_events(occurred_at TIMESTAMPTZ NOT NULL, company_id TEXT NOT NULL, job_id TEXT, worker_id TEXT,
             amount_usd NUMERIC(10,2) NOT NULL, mcc TEXT, result TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'live')
```
`result` is `approved` or `declined`. A hypertable on `occurred_at` when TimescaleDB is available.

## Dashboard read API (`backend/main.py`)

All `GET`, read-only, scoped to `DEMO_COMPANY_ID` (default `co_ballard`, or `?company_id=`). Phones are masked (`•••-•••-1111`), the `/ai/audit` sandbox worker is hidden, and every endpoint returns **503** when MongoDB is unreachable. CORS is open (`CORS_ORIGINS`, default `*`, no credentials).

| Endpoint | Returns |
|---|---|
| `GET /api/dashboard` | `{company, workers, merchants, jobs, cards, requests, approvals, transactions, receipts, activity}` in one read |
| `GET /api/company` | company (owner phone masked) |
| `GET /api/workers` | workers (phones masked) |
| `GET /api/merchants` | merchants |
| `GET /api/jobs` | jobs + `remaining_usd`, `committed_usd` (caps of active cards) |
| `GET /api/jobs/{id}` | job + its `cards`, `requests`, `transactions`, `receipts` |
| `GET /api/jobs/{id}/burn` | `{budget_usd, spent_usd, baseline_usd, points: [{at, spent_usd, amount_usd, merchant_name}]}` cumulative spend; spend from before tracked purchases is the baseline |
| `GET /api/cards?state=` | cards + `job_id` (from the card's request) |
| `GET /api/requests?status=` | card requests with their `policy` result |
| `GET /api/approvals?status=` | approvals + the joined `request` |
| `GET /api/transactions?job_id=&limit=` | transactions, newest first |
| `GET /api/receipts?job_id=` | receipts |
| `GET /api/activity?limit=&job_id=&since=` | activity, newest first (`since` = ISO time, exclusive) |

Dev-only write (404 unless `MESSAGING=dev`), used by the dashboard's Live Agent Demo:
`POST /api/dev/request-card {worker_id, job_id, merchant_name, amount_usd, items, text}` runs the real policy engine and card issuing for an already-parsed request (no AI); the worker's previous active card is terminated first. Returns `request_card_flow`'s result plus the issued `card` (or `null`).
