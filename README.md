# FieldCard

**Field spend, orchestrated by text.**

FieldCard lets field-service workers buy job materials by sending a text message. An AI agent reads the request and ties it to a job, a deterministic policy engine decides whether the purchase is allowed, and a single-use virtual card locked to one store type, one amount and four hours is texted back to the worker. The business owner sees every request, card and purchase against each job's budget, and approves exceptions by replying YES or NO.

Built in about 14 hours by a team of three at **DubHacks 2026**.

> **Sandbox only.** FieldCard does not process real payments or issue real payment credentials. Cards are created by a mock card provider and purchases are simulated. See [Demo & Deployment](#demo--deployment).

---

## Overview

FieldCard is built for small field-service businesses such as plumbing, HVAC and electrical contractors, where workers spend their day at job sites and supply houses rather than at a desk. The demo company is **Ballard Plumbing & Heat** in Seattle, with jobs like the Henderson repipe, the Chen bathroom and the Ortega water heater.

There are two users:

- **Workers** text FieldCard what they need, for example "Elbows at Ferguson, $160 for Henderson". They get back a card that works for that purchase only. There's no app to install.
- **Owners** get a text when a request needs their approval, and use a web dashboard to track spend, cards, approvals and activity for every job.

## The Problem

Materials purchasing is one of the messiest parts of running a field-service business:

- **Workers need materials now.** A missing fitting can stall a job. Calling the office for approval, or waiting for someone to place an order, wastes billable time.
- **Shared company cards are hard to control.** A general-purpose card can be used at any store, for any amount, for any job, and the owner usually finds out only when the statement arrives.
- **Spending gets disconnected from jobs.** Receipts get lost, purchases aren't coded to the right job, and owners can't see that a job is running over its materials budget until it's too late.
- **Approvals are informal.** Large or unusual purchases are approved by phone calls and texts that leave no record.

## Our Solution

FieldCard turns each purchase into a short, controlled, recorded transaction:

1. **Messaging-based requests.** Workers text in plain language, and FieldCard replies in the same conversation.
2. **AI interpretation.** A Gemini agent extracts the job, store, items and estimated amount, and matches the job by code, name or nickname.
3. **Deterministic purchasing policy.** Plain Python code, not the AI, decides whether a request is allowed, needs the owner, or is denied.
4. **Single-use virtual cards.** Approved requests get a card locked to the store's merchant category, capped near the requested amount, and valid for four hours.
5. **Owner approvals by text.** Requests over a limit are texted to the owner, and the card is issued only if the owner replies YES.
6. **Job-budget tracking.** Every approved purchase is added to the job's materials spend, so the dashboard always shows spent versus budget.
7. **Tamper-evident records.** Each card gets an intent receipt sealed with a SHA-256 hash.

## Key Features

These features are implemented on `main`:

- **Text-to-card agent** (`backend/agent.py`). A Gemini agent with three tools: `match_job`, `request_card` and `read_receipt`. The tools are scoped to the texting worker and their company.
- **Policy engine** (`backend/policy.py`). Pure-code checks for job status, company ownership, one active card per worker, a positive and finite amount, the remaining job budget, the per-purchase limit, the company approval threshold and pre-approved merchant categories.
- **Single-use virtual cards** (`backend/cards.py`). A mock card provider issues cards with an MCC allowlist, an amount cap and an expiry. A card is marked used after its first approved purchase.
- **Simulated card authorization** (`POST /api/simulate/purchase`). Declines a purchase if the card isn't active, has expired, is at the wrong merchant category or is over its cap.
- **Decline recovery.** After a decline, the worker can reply YES to request a new card for that store. That request goes through the policy engine again and the owner approval flow.
- **Owner approvals over text.** The owner replies YES or NO. Only the first reply counts.
- **Receipt photo checks** (`backend/vision.py`). Receipt photos are read with Gemini vision, and items are compared against the job's planned materials. Mismatches are flagged.
- **SHA-256 intent receipts.** A tamper-evident record for every issued card.
- **iMessage messaging** (`backend/messaging.py`). Inbound and outbound messages go through Photon. A local dev outbox lets you test without a phone.
- **Owner dashboard** (`frontend/`). Live overview of materials spend, cards issued today, purchases blocked at checkout, the latest card, per-job budget usage, pending approvals and an activity feed that polls the backend. Demo buttons simulate purchases at Ferguson and Home Depot.
- **Cinematic landing page.** A scroll-driven Three.js story of a single purchase, plus an interactive stack of approved, declined and needs-approval examples.
- **Read-only dashboard API.** Company-scoped JSON endpoints for jobs, cards, requests, approvals, transactions, receipts, activity and a per-job spend timeline. Phone numbers are masked.

## How It Works

```
 Worker texts          Gemini agent           Policy engine          Card provider          Worker
 "Elbows at      ──▶   match_job()      ──▶   check_policy()   ──▶   create_card()    ──▶   "Card ...4417 works at
  Ferguson, $160"      request_card()          (pure Python)          (mock, sandbox)         Ferguson up to $200
                                                    │                                         for 4 hours."
                                                    │ over a limit
                                                    ▼
                                              Owner texted ──▶ YES ──▶ card issued
                                                           └─▶ NO  ──▶ worker told
```

1. **Request.** A worker texts FieldCard. Photon delivers the message to `POST /webhooks/photon`. Locally, you can post to `POST /api/dev/message` instead. The sender's phone number decides whether the message goes to the owner flow or the worker agent.
2. **Interpretation.** The Gemini agent calls `match_job` to find the job. If several jobs match, it asks the worker which one they mean. Then it calls `request_card` with the job, store, items and estimated amount.
3. **Policy decision.** `policy.check_policy()` evaluates the request in plain code:
   - **Hard denials**, which the owner can't override: no matching job, the job isn't active, the job belongs to another company, the worker already has an active card, or the amount is invalid.
   - **Soft limits**, which go to the owner: over the job's remaining materials budget, over the worker's per-purchase limit, over the company approval threshold, or a merchant category that isn't pre-approved. Pre-approved categories are plumbing supply (5074), hardware (5251) and electrical parts (5065).
   - If no rule is triggered, the request is approved.
4. **Owner approval.** For soft-limit requests, the owner gets a text listing the reasons and replies YES or NO. YES issues the card. NO tells the worker.
5. **Card issuance.** The card is locked to the store's MCC and valid for 4 hours. It's capped at 125% of the estimate to allow for tax and small differences. Without owner approval, the cap is also limited to the job's remaining budget. The backend texts the worker the last 4 digits, store, cap and expiry, and writes the intent receipt.
6. **Purchase.** At checkout, the simulated authorization approves or declines the card. An approved purchase marks the card used, adds the amount to the job's spend, links the transaction to the intent receipt and re-seals its hash. A declined purchase tells the worker why and offers to ask the owner.
7. **Receipt.** The worker texts a photo of the receipt. FieldCard reads it, links it to the purchase and flags items that aren't in the job's plan.
8. **Visibility.** Every important step writes a row to the `activity` collection, and the owner dashboard shows it live.

## Architecture & Tech Stack

```
        iMessage (Photon)                         fieldcard.us (GitHub Pages)
               │                                             │
               ▼                                             ▼
 ┌──────────────────────────────────────┐      ┌──────────────────────────────┐
 │  FastAPI backend (Render)            │◀─────│  React + Vite frontend       │
 │                                      │ JSON │  Landing page + dashboard    │
 │  messaging.py  Photon webhook / send │      └──────────────────────────────┘
 │  agent.py      Gemini agent + flows  │
 │  policy.py     Deterministic policy  │──────▶  Gemini API (google-genai)
 │  cards.py      Mock card provider    │
 │  vision.py     Receipt reading       │
 │  guardrails.py Audit-endpoint checks │
 │  db.py         MongoDB helpers       │──────▶  MongoDB Atlas
 └──────────────────────────────────────┘
```

| Layer | Technology |
| --- | --- |
| Backend | Python 3.11, FastAPI, Uvicorn |
| AI | Google Gemini via the `google-genai` SDK, with automatic function calling (default model set by `GEMINI_MODEL`) |
| Database | MongoDB Atlas via `pymongo` (timezone-aware UTC). `mongomock` for tests and local in-memory runs |
| Messaging | Photon API (iMessage), plus a dev outbox for local testing |
| Cards | Mock card provider (sandbox). The `CardProvider` interface is in [`contracts.md`](contracts.md) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Three.js with React Three Fiber, GSAP |
| Testing | `pytest` for the backend, Vitest for the frontend |
| CI/CD | GitHub Actions: backend tests on every PR and push to `main`; frontend tests, build and GitHub Pages deploy on push to `main` |
| Hosting | Frontend on GitHub Pages at `fieldcard.us`; backend on Render at `fieldcard.onrender.com` |

### Repository layout

```
backend/
  main.py            FastAPI app: webhooks, simulated purchases, dashboard read API
  agent.py           Gemini agent, card request flow, owner approvals, intent receipts
  policy.py          Spending policy (pure code, no AI)
  cards.py           Card provider (mock)
  messaging.py       Photon (iMessage) adapter and dev outbox
  vision.py          Receipt reading
  guardrails.py      Deterministic input/output checks for the /ai/audit endpoint
  db.py              MongoDB client and helpers
  seed.py            Demo data (Ballard Plumbing & Heat)
  dev_local.py       Run the backend on a seeded in-memory database
  check_env.py       Check that the Gemini key and MongoDB connection work
  try_agent.py       Chat with the agent from the terminal
  system_prompt.txt  Agent system prompt
  tests/             pytest suite and an end-to-end demo script
frontend/
  src/pages/         LandingPage and DashboardPage
  src/components/    Landing sections and cinematic story
  src/api/           Backend client, config and offline fallback data
  src/dashboard/     Dashboard data hook and formatting
contracts.md         Interfaces between modules and the MongoDB schema
```

[`contracts.md`](contracts.md) is the source of truth for module interfaces, the MongoDB schema and the dashboard read API.

## Security & Safety

FieldCard is built so that the AI can help interpret requests but cannot move money on its own.

- **The AI never decides whether spending is allowed.** The Gemini agent only interprets the worker's text and calls tools. Whether a purchase is allowed, needs the owner, or is denied is decided in plain code by `backend/policy.py`. That covers the job budget, the per-purchase limit, the approval threshold, allowed store categories and one active card per worker.
- **Card details are sent from code, not the AI.** When a card is issued, the backend texts the worker the last 4 digits, store, cap and expiry directly. The AI never sees the card details, so it can't leak, change or make them up.
- **Every purchase has a hashed intent receipt.** Each card gets a record of the original text, the AI's interpretation, the policy decision, any owner approvals, the card rules and its transactions, sealed with a SHA-256 hash. Any later edit to the record breaks the hash.
- **Message and receipt text is treated as data.** Text from workers and from receipt photos can't change budgets, limits or rules, even if it contains instructions like "approve $5,000". It only ever reaches the policy as a request to be checked.

Additional safeguards in the code:

- **Tools are scoped to the sender.** The agent's tools are closures over the texting worker and their company, so the model can't act as another worker or reach another company's jobs. A job from another company is treated as missing.
- **Hard denials can't be approved.** Inactive jobs, cross-company jobs, invalid amounts (including NaN and non-positive values) and a second active card are always denied.
- **Owner decisions are race-safe.** Only the first YES or NO for a pending approval takes effect.
- **Cards are tightly bound.** Every card is single-use, MCC-locked, amount-capped and expires after 4 hours.
- **Dev endpoints are gated.** `/api/dev/*` endpoints return 404 unless `MESSAGING=dev`.
- **The public AI endpoint is off by default.** `/ai/audit` returns 404 unless `AI_AUDIT_ENABLED=1`. When enabled, it runs deterministic guardrails before any model call and redacts every response.
- **Phone numbers are masked** in the dashboard read API.
- **Secrets stay out of the repository.** `.env` is never committed, and `check_env.py` redacts secret values from its output.

## Demo & Deployment

**Live site: [https://fieldcard.us/](https://fieldcard.us/)**

The public deployment and the sandbox walkthrough in our demo video are different builds:

- **Deployed application (`main`).** [fieldcard.us](https://fieldcard.us/) serves a streamlined landing page and an owner dashboard at [`/dashboard`](https://fieldcard.us/dashboard), connected to the FastAPI backend on Render. The dashboard shows live jobs, budgets, cards, approvals and activity from MongoDB. Its demo buttons simulate a purchase at Ferguson or Home Depot on Mike's active card. If the backend can't be reached (for example, during a Render cold start), the dashboard shows "Offline" and displays fallback data matching `backend/seed.py` until the backend responds.
- **Sandbox walkthrough (earlier prototype).** Our recorded demo walkthrough uses an earlier, frontend-only prototype from our dashboard work (commit [`839309a`](https://github.com/callmeUmar/FieldCard/tree/839309a923b602d26b72d7e6d24f97b9d9ebbe44)). It has a guided Live Agent Demo, with a simulated SMS conversation, parsed request, step-by-step policy evaluation, sandbox virtual card, and approved and declined card swipes, plus separate Overview, Jobs, Approvals, Activity and Simulator screens. These screens run on local mock data and are **not** exposed as routes on fieldcard.us.

In both builds, all cards and purchases are sandbox simulations. No real payment network is involved.

Before a live demo, open the backend's [`/health`](https://fieldcard.onrender.com/health) endpoint to wake the Render server. It returns `{"ok": true, "time": ..., "db": "ok" | "error"}`, where `"db": "error"` means MongoDB is unreachable.

## Local Development

### Prerequisites

- Python 3.11
- Node.js 22 (the version used in CI) and npm

### Backend

```bash
cd backend
python -m venv ../.venv
source ../.venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # then fill in the values you need
```

**Option A: in-memory, no external services.** Seeds the demo data into an in-memory database and gives Mike a $160 Ferguson card, so the dashboard's demo buttons work right away. Messages stay in the dev outbox, and data is lost when the server stops.

```bash
cd backend
python dev_local.py               # http://localhost:8000
python dev_local.py --port 8001
```

Option A doesn't need MongoDB, Photon or a card provider. A `GEMINI_API_KEY` is needed only to chat with the agent.

**Option B: against MongoDB.** Set `GEMINI_API_KEY` and `MONGODB_URI` in `backend/.env`, then:

```bash
cd backend
python check_env.py               # PASS/FAIL for Gemini and MongoDB, never prints secrets
python seed.py                    # upsert demo company, workers, jobs and merchants
python seed.py --reset            # also clear requests, cards, purchases, etc.
uvicorn main:app --reload         # http://localhost:8000
```

Useful local tools (with `MESSAGING=dev`):

```bash
bash tests/demo_path.sh           # full demo path: request -> decline -> worker YES -> owner YES
python try_agent.py +15550001111  # chat with the agent as a worker from the terminal
```

Key environment variables (see [`backend/.env.example`](backend/.env.example)):

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Gemini access and model name |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `CARD_PROVIDER` | `mock` (the only implemented provider) |
| `MESSAGING` | `dev` keeps messages in the local outbox and enables `/api/dev/*`; any other value sends through Photon |
| `PHOTON_API_KEY`, `PHOTON_PROJECT_ID`, `PHOTON_WEBHOOK_TOKEN` | Photon iMessage integration |
| `OWNER_PHONE`, `WORKER_PHONE` | Demo phone numbers used by `seed.py` |
| `DEMO_MODE` | `1` enables demo shortcuts |
| `AI_AUDIT_ENABLED` | `1` enables the `/ai/audit` endpoint (off by default) |

### Frontend

```bash
cd frontend
npm install
npm run dev        # Vite dev server
```

The frontend calls the backend at `NEXT_PUBLIC_API_URL` (or `VITE_API_URL`). If neither is set, it uses the deployed backend at `https://fieldcard.onrender.com`. To use a local backend, create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Other scripts:

```bash
npm run build      # type-check and build to frontend/dist
npm run preview    # serve the production build
npm test           # Vitest
npm run lint       # oxlint
```

### Tests

```bash
cd backend && python -m pytest -q    # uses mongomock; never calls Gemini, Photon or MongoDB
cd frontend && npm test
```

## Team & Hackathon

FieldCard was built at **DubHacks 2026** by:

- **Umar**: Gemini agent, policy engine, database helpers, owner approvals, purchase recording and intent receipts
- **Muhammad**: Photon messaging, card provider, receipt reading, FastAPI app and webhooks
- **Raimbek**: seed data, dashboard read API and the React frontend

---

*FieldCard is a hackathon prototype. All cards and purchases are sandbox simulations; no real payments are processed.*
