/** Deterministic script for the 90-second Live Agent Demo */

export const DEMO_JOB_ID = 'job-henderson'
export const DEMO_WORKER_ID = 'w-mike'

export const LIVE_AGENT_SMS =
  'Fieldcard — Mike here. For HEN-1042 Henderson kitchen remodel I need 3/4 PEX and brass fittings from Ferguson, about $186.50 today.'

export const PARSED_REQUEST = {
  jobCode: 'HEN-1042',
  jobLabel: 'Henderson kitchen remodel',
  workerName: 'Mike',
  merchant: 'Ferguson Plumbing Supply',
  materials: '3/4 PEX + brass fittings',
  amountCents: 18_650,
  category: 'Plumbing Supply',
}

export const DEMO_VIRTUAL_CARD = {
  lastFour: '4821',
  spendLimitCents: 30_000,
  merchantCategories: ['Plumbing Supply', 'Hardware'],
  expiresInHours: 48,
}

export const ALLOWED_PURCHASE = {
  merchant: 'Ferguson Plumbing Supply',
  category: 'Plumbing Supply',
  amountCents: 18_650,
  label: 'Allowed merchant',
}

export const BLOCKED_PURCHASE = {
  merchant: 'Home Depot Pro',
  category: 'General Retail',
  amountCents: 8_900,
  label: 'Blocked merchant',
}

export const DEMO_STEPS = [
  'sms',
  'parse',
  'policy',
  'card',
  'purchase',
  'outcome',
] as const

export type DemoStepId = (typeof DEMO_STEPS)[number]
