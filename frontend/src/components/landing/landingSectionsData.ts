import { initialSnapshot } from '../../data/mockData'
import { MERCHANTS } from '../../data/merchants'
import {
  BLOCKED_PURCHASE,
  DEMO_VIRTUAL_CARD,
  LIVE_AGENT_SMS,
  PARSED_REQUEST,
} from '../../demo/liveAgentScenario'
import { CARD_VALIDITY_MS, computeCardExpiresAt } from '../../lib/cardLifecycle'
import { formatCurrencyPrecise, jobBudgetUsedPercent, jobRemainingCents } from '../../lib/format'
import {
  AUTO_APPROVE_THRESHOLD_CENTS,
  evaluateAgentRequest,
  evaluatePurchase,
  type PurchaseEvaluation,
} from '../../lib/policyEngine'
import type { Job, VirtualCard, Worker } from '../../types'

/**
 * Read-only content for the landing page's explanatory sections. Every number
 * comes from the seed data and every outcome from the real policy engine, run
 * against throwaway inputs — nothing here touches dashboard state.
 */

const job = (code: string): Job => {
  const found = initialSnapshot.jobs.find((j) => j.code === code)
  if (!found) throw new Error(`Seed data is missing job ${code}`)
  return found
}
const worker = (id: string): Worker => {
  const found = initialSnapshot.workers.find((w) => w.id === id)
  if (!found) throw new Error(`Seed data is missing worker ${id}`)
  return found
}
const merchant = (id: string) => {
  const found = MERCHANTS.find((m) => m._id === id)
  if (!found) throw new Error(`Seed data is missing merchant ${id}`)
  return found
}

const henderson = job(PARSED_REQUEST.jobCode)
const ortega = job('ORT-0988')
const chen = job('CHN-1051')
const mike = worker(henderson.assignedWorkerId)
const priya = worker(ortega.assignedWorkerId)
const luis = worker(chen.assignedWorkerId)
const pacific = merchant('merchant_pacific')
const reviewTxn = initialSnapshot.transactions.find(
  (t) => t.jobId === henderson.id && t.status === 'pending' && t.amountCents > AUTO_APPROVE_THRESHOLD_CENTS,
)
if (!reviewTxn) throw new Error('Seed data is missing the owner-review example')

const usd = formatCurrencyPrecise
const AMOUNT = PARSED_REQUEST.amountCents

/** A fixed issuance moment keeps the expiry example deterministic */
const ISSUED_AT_MS = Date.UTC(2026, 9, 17, 16, 41)
const HOUR = 60 * 60 * 1000

const issuedCard = (status: VirtualCard['status'] = 'active'): VirtualCard => ({
  id: 'card_landing_example',
  jobId: henderson.id,
  lastFour: DEMO_VIRTUAL_CARD.lastFour,
  spendLimitCents: AMOUNT,
  allowedMccs: [...DEMO_VIRTUAL_CARD.allowedMccs],
  issuedAt: new Date(ISSUED_AT_MS).toISOString(),
  expiresAt: computeCardExpiresAt(ISSUED_AT_MS),
  status,
  singleUse: true,
})

const cardHours = CARD_VALIDITY_MS / HOUR

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const requestRules = evaluateAgentRequest(henderson, mike, AMOUNT, PARSED_REQUEST.mcc)
const hendersonAfter = { ...henderson, spentCents: henderson.spentCents + AMOUNT }

export const HOW_IT_WORKS = {
  sms: LIVE_AGENT_SMS,
  worker: mike.name,
  parsed: [
    ['Job', `${PARSED_REQUEST.jobCode} · ${PARSED_REQUEST.jobLabel}`],
    ['Worker', `${mike.name} · ${mike.role}`],
    ['Merchant', PARSED_REQUEST.merchant],
    ['Category', `MCC ${PARSED_REQUEST.mcc}`],
    ['Materials', PARSED_REQUEST.materials],
    ['Amount', usd(AMOUNT)],
  ] as const,
  rules: requestRules.map((r) => ({ id: r.ruleId, title: r.title, detail: r.detail ?? '', passed: r.passed })),
  card: {
    lastFour: DEMO_VIRTUAL_CARD.lastFour,
    cap: usd(AMOUNT),
    mccs: DEMO_VIRTUAL_CARD.allowedMccs.join(', '),
    hours: cardHours,
  },
  result: {
    merchant: PARSED_REQUEST.merchant,
    amount: usd(AMOUNT),
    jobCode: henderson.code,
    remaining: usd(jobRemainingCents(hendersonAfter)),
  },
}

/* ------------------------------------------------------------------ */
/* Spending controls                                                   */
/* ------------------------------------------------------------------ */

export type ControlId = 'budget' | 'worker' | 'mcc' | 'threshold' | 'single-use' | 'expiry'

export type ControlExample = {
  label: string
  who: string
  where: string
  merchant: string
  amount: string
  evaluation: PurchaseEvaluation
  /** Linear rules: where the purchase lands against the limit */
  scale?: Scale
  /** Extra context for the visual (e.g. card uses, time since issue) */
  note: string
}

/** Positions are fractions of the track (0–1; a marker past 1 overflows it) */
export type Scale = {
  min: string
  max: string
  limit: number
  limitLabel: string
  marker: number
  /** Already-committed portion of the track (job spend so far) */
  filled?: number
}

export type Control = {
  id: ControlId
  name: string
  short: string
  statement: string
  /** How the visual renders this rule */
  visual: 'scale' | 'mcc' | 'uses' | 'clock'
  pass: ControlExample
  fail: ControlExample
  failLabel: string
}

const evaluate = (
  j: Job,
  w: Worker,
  m: { name: string; mcc: string },
  amountCents: number,
  card?: VirtualCard,
  nowMs?: number,
) => evaluatePurchase({ job: j, worker: w, merchant: m.name, mcc: m.mcc, amountCents, card, nowMs })

const ferguson = { name: PARSED_REQUEST.merchant, mcc: PARSED_REQUEST.mcc }
const hendersonLabel = `${henderson.code} · ${henderson.customerName}`
const approvedHere = (): ControlExample => ({
  label: 'Within policy',
  who: mike.name,
  where: hendersonLabel,
  merchant: ferguson.name,
  amount: usd(AMOUNT),
  evaluation: evaluate(henderson, mike, ferguson, AMOUNT, issuedCard(), ISSUED_AT_MS + HOUR),
  note: '',
})

const remainingHen = jobRemainingCents(henderson)
const remainingOrt = jobRemainingCents(ortega)
/** Worker and threshold scales share one $0–$300 track so caps can be compared */
const scaleMax = Math.max(...initialSnapshot.workers.map((w) => w.spendingLimitCents))

const budgetScale = (j: Job): Scale => ({
  min: '$0',
  max: usd(j.materialBudgetCents),
  limit: 1,
  limitLabel: `${j.code} budget`,
  filled: j.spentCents / j.materialBudgetCents,
  marker: (j.spentCents + AMOUNT) / j.materialBudgetCents,
})
const capScale = (w: Worker): Scale => ({
  min: '$0',
  max: usd(scaleMax),
  limit: w.spendingLimitCents / scaleMax,
  limitLabel: `${w.name}'s ${usd(w.spendingLimitCents)} cap`,
  marker: AMOUNT / scaleMax,
})
const thresholdScale = (amountCents: number): Scale => ({
  min: '$0',
  max: usd(scaleMax),
  limit: AUTO_APPROVE_THRESHOLD_CENTS / scaleMax,
  limitLabel: `Owner review above ${usd(AUTO_APPROVE_THRESHOLD_CENTS)}`,
  marker: amountCents / scaleMax,
})
const clockScale = (sinceIssueMs: number): Scale => ({
  min: 'Issued',
  max: `+${cardHours}h`,
  limit: 1,
  limitLabel: 'Expires',
  marker: sinceIssueMs / CARD_VALIDITY_MS,
})

export const CONTROLS: Control[] = [
  {
    id: 'budget',
    name: 'Job budget',
    short: `${usd(henderson.materialBudgetCents)} on ${henderson.code}`,
    statement: 'Must fit the job’s remaining budget.',
    visual: 'scale',
    pass: {
      ...approvedHere(),
      scale: budgetScale(henderson),
      note: `${usd(henderson.spentCents)} spent · ${usd(remainingHen)} left before this purchase`,
    },
    fail: {
      label: 'Over budget',
      who: priya.name,
      where: `${ortega.code} · ${ortega.customerName}`,
      merchant: pacific.name,
      amount: usd(AMOUNT),
      evaluation: evaluate(ortega, priya, pacific, AMOUNT),
      scale: budgetScale(ortega),
      note: `${usd(ortega.spentCents)} of ${usd(ortega.materialBudgetCents)} spent · ${usd(remainingOrt)} left`,
    },
    failLabel: 'Over budget',
  },
  {
    id: 'worker',
    name: 'Worker spending limit',
    short: `${mike.name} ${usd(mike.spendingLimitCents)} · ${luis.name} ${usd(luis.spendingLimitCents)}`,
    statement: 'Each worker has a per-purchase cap.',
    visual: 'scale',
    pass: {
      ...approvedHere(),
      scale: capScale(mike),
      note: `${usd(AMOUNT)} of ${mike.name}'s ${usd(mike.spendingLimitCents)} cap`,
    },
    fail: {
      label: 'Over worker cap',
      who: luis.name,
      where: `${chen.code} · ${chen.customerName}`,
      merchant: ferguson.name,
      amount: usd(AMOUNT),
      evaluation: evaluate(chen, luis, ferguson, AMOUNT),
      scale: capScale(luis),
      note: `${usd(AMOUNT)} against ${luis.name}'s ${usd(luis.spendingLimitCents)} cap`,
    },
    failLabel: 'Over worker cap',
  },
  {
    id: 'mcc',
    name: 'Merchant category',
    short: `Card allows MCC ${DEMO_VIRTUAL_CARD.allowedMccs.join(', ')}`,
    statement: 'Only the card’s allowed store types.',
    visual: 'mcc',
    pass: { ...approvedHere(), note: `MCC ${ferguson.mcc} · plumbing supply` },
    fail: {
      label: 'Blocked category',
      who: mike.name,
      where: hendersonLabel,
      merchant: BLOCKED_PURCHASE.merchant,
      amount: usd(BLOCKED_PURCHASE.amountCents),
      evaluation: evaluate(
        henderson,
        mike,
        { name: BLOCKED_PURCHASE.merchant, mcc: BLOCKED_PURCHASE.mcc },
        BLOCKED_PURCHASE.amountCents,
        issuedCard(),
        ISSUED_AT_MS + HOUR,
      ),
      note: `MCC ${BLOCKED_PURCHASE.mcc} · home improvement`,
    },
    failLabel: 'Blocked category',
  },
  {
    id: 'threshold',
    name: 'Approval threshold',
    short: `Auto-approve up to ${usd(AUTO_APPROVE_THRESHOLD_CENTS)}`,
    statement: 'Above the threshold waits for the owner.',
    visual: 'scale',
    pass: { ...approvedHere(), scale: thresholdScale(AMOUNT), note: 'Under the threshold · clears automatically' },
    fail: {
      label: 'Above threshold',
      who: mike.name,
      where: hendersonLabel,
      merchant: reviewTxn.merchant,
      amount: usd(reviewTxn.amountCents),
      evaluation: evaluate(henderson, mike, { name: reviewTxn.merchant, mcc: reviewTxn.mcc }, reviewTxn.amountCents),
      scale: thresholdScale(reviewTxn.amountCents),
      note: 'Valid materials, routed to the owner',
    },
    failLabel: 'Above threshold',
  },
  {
    id: 'single-use',
    name: 'Single-use cards',
    short: 'One authorization per card',
    statement: `One card per request, at ${usd(AMOUNT)}.`,
    visual: 'uses',
    pass: { ...approvedHere(), note: 'First authorization on card •••• ' + DEMO_VIRTUAL_CARD.lastFour },
    fail: {
      label: 'Second swipe',
      who: mike.name,
      where: hendersonLabel,
      merchant: ferguson.name,
      amount: usd(AMOUNT),
      evaluation: evaluate(henderson, mike, ferguson, AMOUNT, issuedCard('used'), ISSUED_AT_MS + HOUR),
      note: 'Same card, tried again',
    },
    failLabel: 'Second swipe',
  },
  {
    id: 'expiry',
    name: 'Card expiration',
    short: `Closes ${cardHours} hours after issue`,
    statement: `Expires ${cardHours} hours after issue.`,
    visual: 'clock',
    pass: { ...approvedHere(), scale: clockScale(HOUR), note: '1 hour after issue' },
    fail: {
      label: 'After expiry',
      who: mike.name,
      where: hendersonLabel,
      merchant: ferguson.name,
      amount: usd(AMOUNT),
      evaluation: evaluate(henderson, mike, ferguson, AMOUNT, issuedCard(), ISSUED_AT_MS + CARD_VALIDITY_MS + 5 * 60 * 1000),
      scale: clockScale(CARD_VALIDITY_MS + 5 * 60 * 1000),
      note: `${cardHours} hours 5 minutes after issue`,
    },
    failLabel: 'After expiry',
  },
]

/* ------------------------------------------------------------------ */
/* Complete visibility (canonical Henderson example)                   */
/* ------------------------------------------------------------------ */

const authorization = evaluate(henderson, mike, ferguson, AMOUNT, issuedCard(), ISSUED_AT_MS + HOUR)

export const VISIBILITY = {
  job: { code: henderson.code, name: henderson.customerName, worker: mike.name },
  budgetCents: henderson.materialBudgetCents,
  before: {
    spentCents: henderson.spentCents,
    remainingCents: jobRemainingCents(henderson),
    percent: jobBudgetUsedPercent(henderson.spentCents, henderson.committedCents, henderson.materialBudgetCents),
  },
  after: {
    spentCents: hendersonAfter.spentCents,
    remainingCents: jobRemainingCents(hendersonAfter),
    percent: jobBudgetUsedPercent(hendersonAfter.spentCents, hendersonAfter.committedCents, hendersonAfter.materialBudgetCents),
  },
  purchase: {
    merchant: ferguson.name,
    mcc: ferguson.mcc,
    amountCents: AMOUNT,
    cardLastFour: DEMO_VIRTUAL_CARD.lastFour,
    checksPassed: authorization.rules.filter((r) => r.passed).length,
    checksTotal: authorization.rules.length,
    status: authorization.status,
  },
  /** Existing Henderson rows from the seed, newest first */
  transactions: initialSnapshot.transactions
    .filter((t) => t.jobId === henderson.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((t) => ({ id: t.id, merchant: t.merchant, amountCents: t.amountCents, status: t.status })),
  activities: initialSnapshot.activities
    .filter((a) => a.jobId === henderson.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 3)
    .map((a) => ({ id: a.id, title: a.title, description: a.description, timestamp: a.timestamp })),
}
