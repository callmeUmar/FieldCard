import { initialSnapshot } from '../data/mockData'
import {
  ALLOWED_PURCHASE,
  BLOCKED_PURCHASE,
  DEMO_JOB_ID,
  DEMO_VIRTUAL_CARD,
  DEMO_WORKER_ID,
  LIVE_AGENT_SMS,
  PARSED_REQUEST,
} from '../demo/liveAgentScenario'
import {
  buildPurchaseNarrative,
  evaluatePurchase,
  formatUsd,
} from '../lib/policyEngine'
import type {
  DashboardSnapshot,
  Job,
  PolicyDecision,
  SimulatePurchaseInput,
  SimulatePurchaseResult,
  Transaction,
} from '../types'

/** Simulated network latency for demo realism */
const delay = (ms = 420) => new Promise((r) => setTimeout(r, ms))

let snapshot: DashboardSnapshot = structuredClone(initialSnapshot)

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function getWorkerAndJob(jobId: string, workerId: string) {
  const job = snapshot.jobs.find((j) => j.id === jobId)
  const worker = snapshot.workers.find((w) => w.id === workerId)
  if (!job || !worker) throw new Error('Job or worker not found')
  return { job, worker }
}

function applyPurchaseToSnapshot(
  input: SimulatePurchaseInput,
  options: { isSimulated: boolean; source: 'simulator' | 'live-demo' },
): SimulatePurchaseResult {
  const jobRef = snapshot.jobs.find((j) => j.id === input.jobId)
  const workerId = input.workerId ?? jobRef?.assignedWorkerId
  if (!jobRef || !workerId) throw new Error('Job or worker not found')
  const { job, worker } = getWorkerAndJob(input.jobId, workerId)
  const card = snapshot.cards.find(
    (c) => c.jobId === input.jobId && c.status === 'active',
  )

  const evaluation = evaluatePurchase({
    job,
    worker,
    merchant: input.merchant,
    category: input.category,
    amountCents: input.amountCents,
    cardCategories: card?.merchantCategories ?? [],
    cardSpendLimitCents: card?.spendLimitCents,
  })

  const txnId = uid('txn')
  const polId = uid('pol')

  const status: Transaction['status'] =
    evaluation.status === 'approved'
      ? options.isSimulated
        ? 'simulated'
        : 'approved'
      : evaluation.status === 'pending'
        ? 'pending'
        : 'declined'

  const transaction: Transaction = {
    id: txnId,
    jobId: input.jobId,
    workerId: worker.id,
    merchant: input.merchant,
    category: input.category,
    amountCents: input.amountCents,
    status,
    cardLastFour: card?.lastFour ?? '0000',
    createdAt: new Date().toISOString(),
    isSimulated: options.isSimulated,
    policyDecisionId: polId,
    declineReason: evaluation.declineReason,
  }

  const policyDecision: PolicyDecision = {
    id: polId,
    transactionId: txnId,
    jobId: input.jobId,
    approved: evaluation.approved,
    summary: evaluation.summary,
    confidence: evaluation.approved ? 0.94 : 0.92,
    evaluatedAt: new Date().toISOString(),
    rules: evaluation.rules,
    aiNarrative: buildPurchaseNarrative(
      input.merchant,
      job.customerName,
      evaluation.approved,
      options.isSimulated,
    ),
  }

  if (evaluation.approved) {
    job.spentCents += input.amountCents
    snapshot.metrics.totalMaterialSpendCents += input.amountCents
  } else if (evaluation.status === 'pending') {
    snapshot.metrics.pendingApprovals += 1
  }

  snapshot.transactions.unshift(transaction)
  snapshot.policyDecisions.unshift(policyDecision)

  const simTag = options.isSimulated ? ' [SIMULATION]' : ''
  const activity = {
    id: uid('act'),
    type: options.source === 'live-demo' ? ('simulation' as const) : ('simulation' as const),
    title: evaluation.approved
      ? options.source === 'live-demo'
        ? 'Live Agent Demo — purchase approved'
        : 'Simulated purchase approved'
      : evaluation.status === 'pending'
        ? 'Simulated purchase pending review'
        : options.source === 'live-demo'
          ? 'Live Agent Demo — purchase declined'
          : 'Simulated purchase declined',
    description: `${input.merchant} — ${formatUsd(input.amountCents)}${simTag}`,
    timestamp: new Date().toISOString(),
    jobId: input.jobId,
    transactionId: txnId,
    meta: { simulated: 'true', source: options.source },
  }
  snapshot.activities.unshift(activity)

  return { transaction, policyDecision, activity }
}

export const fieldcardApi = {
  async getSnapshot(): Promise<DashboardSnapshot> {
    await delay(180)
    return structuredClone(snapshot)
  },

  async getJob(jobId: string): Promise<Job | undefined> {
    await delay(120)
    return snapshot.jobs.find((j) => j.id === jobId)
  },

  async getPolicyDecision(id: string): Promise<PolicyDecision | undefined> {
    await delay(100)
    return snapshot.policyDecisions.find((p) => p.id === id)
  },

  async approveTransaction(transactionId: string): Promise<Transaction | undefined> {
    await delay(300)
    const txn = snapshot.transactions.find((t) => t.id === transactionId)
    if (!txn || txn.status !== 'pending') return undefined

    txn.status = 'approved'
    const job = snapshot.jobs.find((j) => j.id === txn.jobId)
    if (job) job.spentCents += txn.amountCents

    const pol = snapshot.policyDecisions.find((p) => p.transactionId === transactionId)
    if (pol) {
      pol.approved = true
      pol.summary = 'Approved by owner via dashboard'
      const approvalRule = pol.rules.find((r) => r.ruleId === 'r-approval')
      if (approvalRule) {
        approvalRule.passed = true
        approvalRule.detail = `Manually approved by ${snapshot.company.ownerName}`
      }
    }

    snapshot.activities.unshift({
      id: uid('act'),
      type: 'purchase',
      title: 'Owner approved purchase',
      description: `${txn.merchant} — ${formatUsd(txn.amountCents)} on ${job?.customerName ?? 'job'}`,
      timestamp: new Date().toISOString(),
      jobId: txn.jobId,
      transactionId: txn.id,
    })

    snapshot.metrics.pendingApprovals = Math.max(
      0,
      snapshot.metrics.pendingApprovals - 1,
    )

    return { ...txn }
  },

  async declineTransaction(transactionId: string): Promise<Transaction | undefined> {
    await delay(300)
    const txn = snapshot.transactions.find((t) => t.id === transactionId)
    if (!txn || txn.status !== 'pending') return undefined

    txn.status = 'declined'
    txn.declineReason = 'Declined by owner via dashboard'

    const job = snapshot.jobs.find((j) => j.id === txn.jobId)
    snapshot.activities.unshift({
      id: uid('act'),
      type: 'purchase',
      title: 'Owner declined purchase',
      description: `${txn.merchant} on ${job?.customerName ?? 'job'}`,
      timestamp: new Date().toISOString(),
      jobId: txn.jobId,
      transactionId: txn.id,
    })

    snapshot.metrics.pendingApprovals = Math.max(
      0,
      snapshot.metrics.pendingApprovals - 1,
    )

    return { ...txn }
  },

  async simulatePurchase(input: SimulatePurchaseInput): Promise<SimulatePurchaseResult> {
    await delay(650)
    return applyPurchaseToSnapshot(input, {
      isSimulated: true,
      source: 'simulator',
    })
  },

  /** Record SMS + card issuance from the Live Agent Demo (deterministic) */
  async recordLiveAgentSetup(): Promise<void> {
    await delay(500)
    const job = snapshot.jobs.find((j) => j.id === DEMO_JOB_ID)
    if (!job) return

    snapshot.activities.unshift(
      {
        id: uid('act'),
        type: 'sms',
        title: 'Live Agent Demo — inbound SMS',
        description: LIVE_AGENT_SMS,
        timestamp: new Date().toISOString(),
        jobId: DEMO_JOB_ID,
        meta: { simulated: 'true', source: 'live-demo' },
      },
      {
        id: uid('act'),
        type: 'card_issued',
        title: 'Live Agent Demo — sandbox card issued',
        description: `Card •••• ${DEMO_VIRTUAL_CARD.lastFour} — ${formatUsd(DEMO_VIRTUAL_CARD.spendLimitCents)} cap for ${PARSED_REQUEST.jobCode}`,
        timestamp: new Date().toISOString(),
        jobId: DEMO_JOB_ID,
        meta: { simulated: 'true', source: 'live-demo' },
      },
      {
        id: uid('act'),
        type: 'policy_check',
        title: 'Live Agent Demo — policy passed',
        description: `Agent approved ${formatUsd(PARSED_REQUEST.amountCents)} ${PARSED_REQUEST.materials} for ${PARSED_REQUEST.jobLabel}`,
        timestamp: new Date().toISOString(),
        jobId: DEMO_JOB_ID,
        meta: { simulated: 'true', source: 'live-demo' },
      },
    )
  },

  async runLiveAgentPurchase(
    variant: 'allowed' | 'blocked',
  ): Promise<SimulatePurchaseResult> {
    await delay(700)
    const purchase = variant === 'allowed' ? ALLOWED_PURCHASE : BLOCKED_PURCHASE
    return applyPurchaseToSnapshot(
      {
        jobId: DEMO_JOB_ID,
        workerId: DEMO_WORKER_ID,
        merchant: purchase.merchant,
        category: purchase.category,
        amountCents: purchase.amountCents,
      },
      { isSimulated: true, source: 'live-demo' },
    )
  },

  async resetDemo(): Promise<void> {
    await delay(200)
    snapshot = structuredClone(initialSnapshot)
  },
}
