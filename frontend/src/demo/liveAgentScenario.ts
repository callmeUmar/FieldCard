import {
  MERCHANTS,
  MCC_PLUMBING_SUPPLY,
} from '../data/merchants'

/** Deterministic script for the 90-second Live Agent Demo */

export const DEMO_JOB_ID = 'job_henderson'
export const DEMO_WORKER_ID = 'w_mike'

const ferguson = MERCHANTS.find((m) => m._id === 'merchant_ferguson')!
const homeDepot = MERCHANTS.find((m) => m._id === 'merchant_home_depot')!

export const LIVE_AGENT_SMS =
  'Fieldcard — Mike here. For HEN-1042 Henderson kitchen remodel I need 3/4 PEX and brass fittings from Ferguson, about $186.50 today.'

export const PARSED_REQUEST = {
  jobCode: 'HEN-1042',
  jobLabel: 'Henderson kitchen remodel',
  workerName: 'Mike',
  merchant: ferguson.name,
  materials: '3/4 PEX + brass fittings',
  amountCents: 18_650,
  mcc: ferguson.mcc,
}

/** Display metadata — spend cap & expiry come from issuance (approved request amount, +4h) */
export const DEMO_VIRTUAL_CARD = {
  lastFour: '4821',
  allowedMccs: [MCC_PLUMBING_SUPPLY],
}

export const LIVE_DEMO_CARD_ID = 'card_live_demo_hen'

export const ALLOWED_PURCHASE = {
  merchant: ferguson.name,
  mcc: ferguson.mcc,
  amountCents: 18_650,
  label: 'Allowed merchant',
}

export const BLOCKED_PURCHASE = {
  merchant: homeDepot.name,
  mcc: homeDepot.mcc,
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
