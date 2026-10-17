#!/usr/bin/env bash
# Full demo path against a running backend (MESSAGING=dev):
#   request at Ferguson -> purchase at Home Depot (declined) -> worker YES -> owner YES
#
#   cd backend && uvicorn main:app --reload
#   bash tests/demo_path.sh
#
# Override the defaults to match your seed data:
#   BASE=http://localhost:8000 WORKER_ID=w_mike WORKER_PHONE=+15550001111 OWNER_PHONE=+15550009999 bash tests/demo_path.sh
set -euo pipefail

BASE="${BASE:-http://localhost:8000}"
WORKER_ID="${WORKER_ID:-w_mike}"
WORKER_PHONE="${WORKER_PHONE:-+15550001111}"
OWNER_PHONE="${OWNER_PHONE:-+15550009999}"

say() { printf '\n=== %s\n' "$1"; }

text() { # text <from_phone> <message>
  curl -sS -X POST "$BASE/api/dev/message" -H 'Content-Type: application/json' \
    -d "{\"from_phone\": \"$1\", \"text\": \"$2\"}"
  echo
}

purchase() { # purchase <merchant> <amount>
  curl -sS -X POST "$BASE/api/simulate/purchase" -H 'Content-Type: application/json' \
    -d "{\"worker_id\": \"$WORKER_ID\", \"merchant_name\": \"$1\", \"amount\": $2}"
  echo
}

say "1. Worker asks for materials at Ferguson (card should be issued)"
text "$WORKER_PHONE" "Need 60 dollars of PEX fittings at Ferguson for the Henderson job"

say "2. Worker tries the card at Home Depot (should be declined: wrong store)"
purchase "Home Depot" 60

say "3. Worker replies YES to ask the owner for a Home Depot card"
text "$WORKER_PHONE" "YES"

say "4. Owner replies YES (card for Home Depot is issued and texted to the worker)"
text "$OWNER_PHONE" "YES"

say "5. Worker buys at Home Depot with the new card (should be approved)"
purchase "Home Depot" 60

say "Texts sent (dev outbox)"
curl -sS "$BASE/api/dev/outbox"
echo
