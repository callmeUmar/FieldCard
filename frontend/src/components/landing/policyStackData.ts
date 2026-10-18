import { initialSnapshot } from '../../data/mockData'
import { BLOCKED_PURCHASE, PARSED_REQUEST } from '../../demo/liveAgentScenario'
import { formatCurrencyPrecise } from '../../lib/format'
import { AUTO_APPROVE_THRESHOLD_CENTS } from '../../lib/policyEngine'

/**
 * Three illustrative sandbox decisions for the landing page's card stack,
 * derived from the seed data and policy constants. Presentation only — nothing
 * here executes a purchase or touches dashboard state.
 */

export type StackStatus = 'approved' | 'declined' | 'review'

export type StackCard = {
  id: StackStatus
  status: StackStatus
  label: string
  merchant: string
  amountCents: number
  amount: string
  job: string
  reason: string
  /** Shown in the section's legend */
  summary: string
}

const henderson = initialSnapshot.jobs.find((job) => job.code === PARSED_REQUEST.jobCode)
const pendingReview = initialSnapshot.transactions.find(
  (txn) => txn.status === 'pending' && txn.amountCents > AUTO_APPROVE_THRESHOLD_CENTS,
)
if (!henderson || !pendingReview) throw new Error('Seed data is missing the policy stack examples')

const jobLabel = `${henderson.code} · ${henderson.customerName}`

export const STACK_CARDS: StackCard[] = [
  {
    id: 'approved',
    status: 'approved',
    label: 'Approved',
    merchant: PARSED_REQUEST.merchant,
    amountCents: PARSED_REQUEST.amountCents,
    amount: formatCurrencyPrecise(PARSED_REQUEST.amountCents),
    job: jobLabel,
    reason: `MCC ${PARSED_REQUEST.mcc} · Within spending limits`,
    summary: 'Cleared automatically, inside your rules',
  },
  {
    id: 'declined',
    status: 'declined',
    label: 'Declined',
    merchant: BLOCKED_PURCHASE.merchant,
    amountCents: BLOCKED_PURCHASE.amountCents,
    amount: formatCurrencyPrecise(BLOCKED_PURCHASE.amountCents),
    job: jobLabel,
    reason: `MCC ${BLOCKED_PURCHASE.mcc} · Not an allowed category`,
    summary: 'Blocked at the counter by merchant category',
  },
  {
    id: 'review',
    status: 'review',
    label: 'Needs approval',
    merchant: pendingReview.merchant,
    amountCents: pendingReview.amountCents,
    amount: formatCurrencyPrecise(pendingReview.amountCents),
    job: jobLabel,
    reason: `Above the ${formatCurrencyPrecise(AUTO_APPROVE_THRESHOLD_CENTS).replace('.00', '')} approval threshold`,
    summary: 'Routed to the owner before money moves',
  },
]
