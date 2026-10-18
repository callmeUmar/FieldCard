import { initialSnapshot } from '../../../data/mockData'
import { DEMO_VIRTUAL_CARD, PARSED_REQUEST } from '../../../demo/liveAgentScenario'
import {
  DEMO_CONTEXT,
  SMS_AGENT_APPROVED,
  SMS_AGENT_CHECKING,
  SMS_WORKER_MESSAGE,
} from '../../../demo/smsConversation'
import { formatCurrencyPrecise, jobBudgetUsedPercent, jobRemainingCents } from '../../../lib/format'

/** Copy shared by the 3D textures, the DOM overlays and the static fallback. */

export const AMOUNT_CENTS = PARSED_REQUEST.amountCents
export const AMOUNT = formatCurrencyPrecise(PARSED_REQUEST.amountCents)

export const SCREEN_COPY = {
  checkIn: `You're on the Henderson job (${PARSED_REQUEST.jobCode}). Text me what you need and where.`,
  request: SMS_WORKER_MESSAGE,
  checking: SMS_AGENT_CHECKING,
  approved: SMS_AGENT_APPROVED,
  company: DEMO_CONTEXT.company,
  /** Policy checks shown in the thread once the engine has run. */
  policyChecks: ['Budget', `${DEMO_CONTEXT.workerLimit} limit`, `MCC ${PARSED_REQUEST.mcc}`],
}

export const CARD_COPY = {
  lastFour: DEMO_VIRTUAL_CARD.lastFour,
  holder: `${DEMO_CONTEXT.worker} · ${PARSED_REQUEST.jobCode}`.toUpperCase(),
  specs: [
    { label: 'Job', value: `${PARSED_REQUEST.jobCode} · Henderson remodel` },
    { label: 'Spend cap', value: AMOUNT },
    { label: 'Merchant', value: `MCC ${PARSED_REQUEST.mcc} · Plumbing supply` },
    { label: 'Expires', value: '4 hours · 1:41 PM' },
    { label: 'Use', value: 'Single-use' },
  ],
}

export const DECISION_META = `${PARSED_REQUEST.merchant} · MCC ${PARSED_REQUEST.mcc} · Sandbox authorization`

export const BEATS = {
  request: {
    kicker: '01 · 9:41 AM, Ferguson',
    title: 'A request arrives by text.',
    body: `${DEMO_CONTEXT.worker} is at the counter with fittings for the Henderson job. No app to open, no company card in his wallet.`,
  },
  policy: {
    kicker: '02 · Policy',
    title: 'Rules run before money moves.',
    body: `Fieldcard checks the ${PARSED_REQUEST.jobCode} budget (${DEMO_CONTEXT.jobBudgetRemaining} left), ${DEMO_CONTEXT.worker}'s ${DEMO_CONTEXT.workerLimit} limit and the merchant category.`,
  },
  card: {
    kicker: '03 · Card',
    title: 'One request. One card.',
    body: 'A single-use virtual card is issued for exactly this purchase — and nothing else.',
  },
  limits: {
    kicker: '04 · Constraints',
    title: 'Locked to the job.',
    body: 'Job, cap, merchant category and expiry are written into the card itself.',
  },
  payoff: {
    kicker: '06 · Job costing',
    title: 'Every purchase, tied to the right job.',
    body: `The approved ${AMOUNT} posts to ${PARSED_REQUEST.jobCode} the moment it clears, so the owner's job costing is current before ${DEMO_CONTEXT.worker} leaves the counter.`,
  },
} as const

/**
 * What the owner sees after the approval: the canonical Henderson job before and
 * after the $186.50 Ferguson purchase. Computed in integer cents from the seed
 * data with the dashboard's own helpers — the landing page never executes or
 * records a transaction.
 */
const henderson = initialSnapshot.jobs.find((job) => job.code === PARSED_REQUEST.jobCode)
if (!henderson) throw new Error(`Seed data is missing job ${PARSED_REQUEST.jobCode}`)
const hendersonAfter = { ...henderson, spentCents: henderson.spentCents + PARSED_REQUEST.amountCents }
const committedSpend = (job: typeof henderson) => job.spentCents + job.committedCents
const exactUsed = (job: typeof henderson) => (committedSpend(job) / job.materialBudgetCents) * 100

export const JOB_IMPACT = {
  jobName: henderson.customerName,
  code: henderson.code,
  worker: DEMO_CONTEXT.worker,
  merchant: PARSED_REQUEST.merchant,
  mcc: PARSED_REQUEST.mcc,
  lastFour: DEMO_VIRTUAL_CARD.lastFour,
  amount: AMOUNT,
  cents: {
    budget: henderson.materialBudgetCents,
    spentBefore: committedSpend(henderson),
    spentAfter: committedSpend(hendersonAfter),
    remainingBefore: jobRemainingCents(henderson),
    remainingAfter: jobRemainingCents(hendersonAfter),
  },
  budget: formatCurrencyPrecise(henderson.materialBudgetCents),
  spentBefore: formatCurrencyPrecise(committedSpend(henderson)),
  spentAfter: formatCurrencyPrecise(committedSpend(hendersonAfter)),
  remainingBefore: formatCurrencyPrecise(jobRemainingCents(henderson)),
  remainingAfter: formatCurrencyPrecise(jobRemainingCents(hendersonAfter)),
  /** Exact shares for the budget bar; the labels use the dashboard's rounding. */
  usedBefore: exactUsed(henderson),
  usedAfter: exactUsed(hendersonAfter),
  usedBeforeLabel: `${jobBudgetUsedPercent(henderson.spentCents, henderson.committedCents, henderson.materialBudgetCents)}%`,
  usedAfterLabel: `${jobBudgetUsedPercent(hendersonAfter.spentCents, hendersonAfter.committedCents, hendersonAfter.materialBudgetCents)}%`,
}
