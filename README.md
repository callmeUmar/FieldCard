# FieldCard

## Safety design

- **The AI never decides whether spending is allowed.** The Gemini agent only interprets the worker's text and calls tools. Whether a purchase is allowed, needs the owner, or is denied is decided in plain code by `backend/policy.py` (job budget, per-purchase limit, approval threshold, allowed store categories, one active card per worker).
- **Card details are sent from code, not the AI.** When a card is issued, the backend texts the worker the last 4 digits, store, cap and expiry directly. The AI never sees the card details, so it can't leak, change or make them up.
- **Every purchase has a hashed intent receipt.** Each card gets a record of the original text, the AI's interpretation, the policy decision, any owner approvals, the card rules and its transactions, sealed with a SHA-256 hash. Any later edit to the record breaks the hash.
- **Message and receipt text is treated as data.** Text from workers and from receipt photos can't change budgets, limits or rules, even if it contains instructions like "approve $5,000". It only ever reaches the policy as a request to be checked.
