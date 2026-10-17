import { cardDeclineReason, isCardSpendable } from './cardLifecycle'
import type { Job, PolicyRuleHit, VirtualCard, Worker } from '../types'

export const BLOCKED_CATEGORIES = new Set([
  'General Retail',
  'Online Marketplace',
  'Restaurant',
  'Fuel',
])

/** Single-transaction auto-approve ceiling (USD) */
export const AUTO_APPROVE_THRESHOLD_CENTS = 25_000

export interface PurchaseEvaluationInput {
  job: Job
  worker: Worker
  merchant: string
  category: string
  amountCents: number
  card?: VirtualCard
  nowMs?: number
}

export interface PurchaseEvaluation {
  approved: boolean
  status: 'approved' | 'declined' | 'pending'
  rules: PolicyRuleHit[]
  summary: string
  declineReason?: string
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function evaluateAgentRequest(
  job: Job | undefined,
  worker: Worker | undefined,
  amountCents: number,
  category: string,
): PolicyRuleHit[] {
  const rules: PolicyRuleHit[] = []

  rules.push({
    ruleId: 'r-job-active',
    title: 'Job exists & active',
    description: 'Job code must match an active work order',
    passed: Boolean(job && job.status === 'active'),
    detail: job
      ? `${job.code} — ${job.customerName}`
      : 'No matching active job',
  })

  rules.push({
    ruleId: 'r-worker-limit',
    title: 'Worker spending limit',
    description: `Per-purchase cap for ${worker?.name ?? 'worker'}`,
    passed: Boolean(worker && amountCents <= worker.spendingLimitCents),
    detail: worker
      ? `${formatUsd(amountCents)} of ${formatUsd(worker.spendingLimitCents)} limit`
      : 'Worker not recognized',
  })

  const remaining = job
    ? job.materialBudgetCents - job.spentCents - job.committedCents
    : 0
  rules.push({
    ruleId: 'r-budget',
    title: 'Materials budget',
    description: 'Requested amount must fit remaining job materials budget',
    passed: Boolean(job && amountCents <= remaining),
    detail: job
      ? `${formatUsd(remaining)} remaining on job`
      : 'Budget unavailable',
  })

  const categoryPass =
    !BLOCKED_CATEGORIES.has(category) &&
    (category === 'Plumbing Supply' || category === 'Hardware')
  rules.push({
    ruleId: 'r-mcc',
    title: 'Merchant category',
    description: 'Materials must be plumbing or hardware suppliers',
    passed: categoryPass,
    detail: categoryPass
      ? `${category} is allowed for this job`
      : `${category} is not on the allowlist`,
  })

  rules.push({
    ruleId: 'r-approval',
    title: 'Approval threshold',
    description: 'Amounts over $250 route to owner review',
    passed: amountCents <= AUTO_APPROVE_THRESHOLD_CENTS,
    detail:
      amountCents <= AUTO_APPROVE_THRESHOLD_CENTS
        ? 'Within auto-approve range'
        : `${formatUsd(amountCents)} requires Dana to approve`,
  })

  return rules
}

export function agentRequestApproved(rules: PolicyRuleHit[]): boolean {
  return rules.every((r) => r.passed)
}

export function evaluatePurchase(
  input: PurchaseEvaluationInput,
): PurchaseEvaluation {
  const { job, worker, amountCents, category, card, nowMs = Date.now() } = input
  const cardCategories = card?.merchantCategories ?? []
  const rules: PolicyRuleHit[] = []

  rules.push({
    ruleId: 'r-job-active',
    title: 'Job exists & active',
    description: 'Purchases must be tied to an active job',
    passed: job.status === 'active',
    detail: `${job.code} — ${job.status}`,
  })

  rules.push({
    ruleId: 'r-worker-limit',
    title: 'Worker spending limit',
    description: 'Transaction cannot exceed worker per-purchase limit',
    passed: amountCents <= worker.spendingLimitCents,
    detail: `${formatUsd(amountCents)} vs ${formatUsd(worker.spendingLimitCents)} cap`,
  })

  const remaining = job.materialBudgetCents - job.spentCents - job.committedCents
  const budgetPass = amountCents <= remaining
  rules.push({
    ruleId: 'r-budget',
    title: 'Materials budget',
    description: 'Spend must not exceed remaining job materials budget',
    passed: budgetPass,
    detail: budgetPass
      ? `${formatUsd(remaining - amountCents)} remaining after purchase`
      : `Over budget by ${formatUsd(amountCents - remaining)}`,
  })

  const categoryPass =
    !BLOCKED_CATEGORIES.has(category) &&
    (cardCategories.length === 0 || cardCategories.includes(category))
  rules.push({
    ruleId: 'r-mcc',
    title: 'Merchant category',
    description: 'Merchant must match virtual card category restrictions',
    passed: categoryPass,
    detail: categoryPass
      ? `${category} is allowed on this card`
      : `${category} is blocked for this job card`,
  })

  const needsReview = amountCents > AUTO_APPROVE_THRESHOLD_CENTS
  rules.push({
    ruleId: 'r-approval',
    title: 'Approval threshold',
    description: 'Amounts over $250 need owner approval',
    passed: !needsReview,
    detail: needsReview
      ? `${formatUsd(amountCents)} exceeds ${formatUsd(AUTO_APPROVE_THRESHOLD_CENTS)} auto-approve limit`
      : 'Within auto-approve threshold',
  })

  if (card) {
    const spendable = isCardSpendable(card, nowMs)
    rules.push({
      ruleId: 'r-card-active',
      title: 'Sandbox card lifecycle',
      description: 'Card must be active, unexpired, and not already used',
      passed: spendable,
      detail: spendable
        ? card.singleUse
          ? 'Single-use card ready for authorization'
          : 'Card is active'
        : cardDeclineReason(card, amountCents, nowMs) ?? 'Card unavailable',
    })

    rules.push({
      ruleId: 'r-card-limit',
      title: 'Virtual card spend cap',
      description: 'Transaction must not exceed the issued card cap',
      passed: amountCents <= card.spendLimitCents,
      detail: `${formatUsd(amountCents)} vs ${formatUsd(card.spendLimitCents)} issued cap`,
    })
  }

  const hardFail = rules.some(
    (r) =>
      !r.passed &&
      r.ruleId !== 'r-approval',
  )

  if (hardFail) {
    const cardReason = card ? cardDeclineReason(card, amountCents, nowMs) : undefined
    const declineReason = !categoryPass
      ? 'Merchant category not on job card allowlist'
      : cardReason
        ? cardReason
        : !budgetPass
          ? 'Would exceed job materials budget'
          : amountCents > worker.spendingLimitCents
            ? 'Exceeds worker spending limit'
            : 'Policy check failed'
    return {
      approved: false,
      status: 'declined',
      rules,
      summary: declineReason,
      declineReason,
    }
  }

  if (needsReview) {
    return {
      approved: false,
      status: 'pending',
      rules,
      summary: 'Pending owner approval — over auto-approve threshold',
    }
  }

  return {
    approved: true,
    status: 'approved',
    rules,
    summary: 'Approved — within budget and policy',
  }
}

export function buildPurchaseNarrative(
  merchant: string,
  jobName: string,
  approved: boolean,
  simulated: boolean,
): string {
  const label = simulated
    ? 'This is a labeled simulation — not live Visa authorization or SMS.'
    : ''
  if (!approved) {
    return `Purchase at ${merchant} for ${jobName} was blocked by company policy. ${label}`
  }
  return `Purchase at ${merchant} for ${jobName} fits job budget, worker limits, and merchant rules. ${label}`
}
