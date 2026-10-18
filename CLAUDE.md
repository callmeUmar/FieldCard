# Fieldcard

Hackathon project (~14 hours, 3 people). Trade workers (plumbers) text a phone number asking to buy materials for a job. Fieldcard matches the job, checks policy, and issues a single-use virtual card that only works for that purchase.

See [contracts.md](contracts.md) for the interfaces between modules and the MongoDB schema. Treat it as the source of truth; change it in a PR before changing an interface.

## Product flow

1. A worker texts something like "need $180 of PEX and fittings at Ferguson for Henderson".
2. A Gemini agent interprets the message and matches it to a job (by code, name or alias).
3. A pure-code policy engine (`policy.py`) checks the job's materials budget, the worker's per-purchase limit and the company's approval threshold.
4. If allowed, the system issues a single-use virtual card locked to a merchant category (MCC), an amount cap and a 4-hour expiry, and texts the worker the details.
5. Over-limit requests are texted to the owner for YES/NO. The card is issued only on YES.
6. Purchases at the wrong kind of store (MCC not allowed) are declined.
7. Workers text receipt photos. OCR extracts the items, which are checked against the job's planned materials; mismatches are flagged.
8. Every purchase gets a tamper-evident **intent receipt**: the original text, the interpretation, the policy decision, approvals, card rules and transaction IDs, sealed with a SHA-256 hash.

## Ownership

| Person | Owns |
|---|---|
| Umar | `agent.py` (Gemini agent), `policy.py` (policy engine), `db.py` (database helpers), owner approvals, purchase recording, intent receipts, `system_prompt.txt` |
| Muhammad | `messaging.py` (Photon SMS adapter), `cards.py` (card provider), `vision.py` (receipt OCR), `main.py` skeleton and webhooks |
| Raimbek | `tiger.py`, `seed.py`, read endpoints, React (Vite) `frontend/` |

Coordinate before editing a file someone else owns.

## Layout

```
backend/
  main.py            FastAPI app, webhooks
  db.py              MongoDB client and helpers
  policy.py          Policy engine (pure code, no AI)
  agent.py           Gemini agent with tools
  system_prompt.txt  Agent system prompt
  cards.py           CardProvider (mock / real)
  messaging.py       SMS adapter (dev / Photon)
  vision.py          Receipt OCR
  tiger.py           Tiger (Postgres) integration
  seed.py            Demo data
  requirements.txt
  .env.example
frontend/            React + Vite dashboard (VITE_API_URL, defaults to https://fieldcard.onrender.com)
```

## Rules

- **Python 3.11**, **FastAPI**.
- **pymongo** with `tz_aware=True`. Store datetimes as timezone-aware UTC.
- **google-genai** SDK (not the old `google-generativeai`) with automatic function calling: pass Python functions as tools.
- **String IDs** with readable prefixes, e.g. `job_henderson`, `worker_luis`, `req_...`. No ObjectIds.
- Every important write (request created, policy decision, approval asked/decided, card issued, transaction, receipt, intent receipt) also inserts a row into the `activity` collection.
- **The AI never decides whether spending is allowed.** The agent interprets and calls tools; `policy.py` makes the decision in plain code.
- **Never commit `.env`.** Add new variables to `backend/.env.example`.
- **All work goes through PRs.** No direct pushes to `main`.

## Configuration

Environment variables are in `backend/.env.example`. `CARD_PROVIDER=mock` and `MESSAGING=dev` let the backend run without external services. `DEMO_MODE=1` enables demo shortcuts.

## Demo

Before each judging slot, open /health to wake the Render server. It returns `{"ok": true, "time": ..., "db": "ok" | "error"}`; `"db": "error"` means MongoDB is unreachable.
