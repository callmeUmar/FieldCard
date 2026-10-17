# Fieldcard Dashboard (Frontend)

Owner dashboard for **Ballard Plumbing & Heat** — DubHacks 2026 demo UI.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- React Router
- Lucide icons

## Commands

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Backend integration

All data flows through `src/api/adapter.ts`. Replace mock implementations in `fieldcardApi` with real HTTP calls; keep the return types in `src/types/index.ts` stable so pages do not need rewrites.

Mock seed data lives in `src/data/mockData.ts`. Policy logic is shared in `src/lib/policyEngine.ts`.

## Demo notes

- Header shows **Demo Mode** while using mocks.
- **Live Agent Demo** (`/live-demo`) is the primary judging flow — fully simulated SMS, AI parsing, policy, and card swipes.
- **Transaction simulator** runs the same policy engine with visible result banners.
