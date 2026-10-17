import { initialSnapshot } from '../data/mockData'
import {
  ALLOWED_PURCHASE,
  BLOCKED_PURCHASE,
  DEMO_JOB_ID,
  DEMO_VIRTUAL_CARD,
  DEMO_WORKER_ID,
  LIVE_AGENT_SMS,
  LIVE_DEMO_CARD_ID,
  PARSED_REQUEST,
} from '../demo/liveAgentScenario'
import { computeCardExpiresAt } from '../lib/cardLifecycle'
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
  VirtualCard,
} from '../types'

/** Simulated network latency for demo realism */
const delay = (ms = 420) =>
  import.meta.env.VITEST
    ? Promise.resolve()
    : new Promise((r) => setTimeout(r, ms))

let snapshot: DashboardSnapshot = structuredClone(initialSnapshot)

interface LiveDemoSession {
  setupRecorded: boolean
  issuedCardId: string | null
  purchaseInFlight: boolean
  allowedPurchaseSettled: boolean
}

const liveDemoSession: LiveDemoSession = {
  setupRecorded: false,
  issuedCardId: null,
  purchaseInFlight: false,
  allowedPurchaseSettled: false,
}

function resetLiveDemoSession(): void {
  liveDemoSession.setupRecorded = false
  liveDemoSession.issuedCardId = null
  liveDemoSession.purchaseInFlight = false
  liveDemoSession.allowedPurchaseSettled = false
}

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function getWorkerAndJob(jobId: string, workerId: string) {
  const job = snapshot.jobs.find((j) => j.id === jobId)
  const worker = snapshot.workers.find((w) => w.id === workerId)
  if (!job || !worker) throw new Error('Job or worker not found')
  return { job, worker }
}

function resolveCardForPurchase(jobId: string): VirtualCard | undefined {
  if (liveDemoSession.issuedCardId) {
    const live = snapshot.cards.find((c) => c.id === liveDemoSession.issuedCardId)
    if (live && live.jobId === jobId) return live
  }
  return snapshot.cards.find((c) => c.jobId === jobId && c.status === 'active')
}

function issueLiveDemoCard(issuedAt: Date): VirtualCard {
  for (const c of snapshot.cards) {
    if (c.jobId === DEMO_JOB_ID && c.status === 'active') {
      c.status = 'frozen'
    }
  }

  const existing = snapshot.cards.find((c) => c.id === LIVE_DEMO_CARD_ID)
  const card: VirtualCard = {
    id: LIVE_DEMO_CARD_ID,
    jobId: DEMO_JOB_ID,
    lastFour: DEMO_VIRTUAL_CARD.lastFour,
    spendLimitCents: PARSED_REQUEST.amountCents,
    merchantCategories: [...DEMO_VIRTUAL_CARD.merchantCategories],
    issuedAt: issuedAt.toISOString(),
    expiresAt: computeCardExpiresAt(issuedAt),
    status: 'active',
    singleUse: true,
  }

  if (existing) {
    Object.assign(existing, card)
  } else {
    snapshot.cards.push(card)
  }

  liveDemoSession.issuedCardId = card.id
  return card
}

function applyPurchaseToSnapshot(
  input: SimulatePurchaseInput,
  options: { isSimulated: boolean; source: 'simulator' | 'live-demo' },
): SimulatePurchaseResult {
  const jobRef = snapshot.jobs.find((j) => j.id === input.jobId)
  const workerId = input.workerId ?? jobRef?.assignedWorkerId
  if (!jobRef || !workerId) throw new Error('Job or worker not found')

  const spentBefore = jobRef.spentCents
  const { job, worker } = getWorkerAndJob(input.jobId, workerId)
  const card = resolveCardForPurchase(input.jobId)

  const evaluation = evaluatePurchase({
    job,
    worker,
    merchant: input.merchant,
    category: input.category,
    amountCents: input.amountCents,
    card,
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
    if (card?.singleUse) {
      card.status = 'used'
    }
  } else if (evaluation.status === 'pending') {
    snapshot.metrics.pendingApprovals += 1
  }

  if (!evaluation.approved && job.spentCents !== spentBefore) {
    throw new Error('Declined purchase must not change job spend')
  }

  snapshot.transactions.unshift(transaction)
  snapshot.policyDecisions.unshift(policyDecision)

  const simTag = options.isSimulated ? ' [SIMULATION]' : ''
  const activity = {
    id: uid('act'),
    type: 'simulation' as const,
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

export class DuplicatePurchaseError extends Error {
  constructor(message = 'Purchase already in progress or completed') {
    super(message)
    this.name = 'DuplicatePurchaseError'
  }
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

  getLiveDemoCard(): VirtualCard | undefined {
    if (!liveDemoSession.issuedCardId) return undefined
    return snapshot.cards.find((c) => c.id === liveDemoSession.issuedCardId)
  },

  async approveTransaction(transactionId: string): Promise<Transaction | undefined> {
    await delay(300)
    const txn = snapshot.transactions.find((t) => t.id === transactionId)
    if (!txn || txn.status !== 'pending') return undefined

    const job = snapshot.jobs.find((j) => j.id === txn.jobId)
    if (!job) return undefined

    const spentBefore = job.spentCents
    txn.status = 'approved'
    job.spentCents += txn.amountCents

    if (job.spentCents <= spentBefore) {
      throw new Error('Approval must increase job spend')
    }

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
      description: `${txn.merchant} — ${formatUsd(txn.amountCents)} on ${job.customerName}`,
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

    const job = snapshot.jobs.find((j) => j.id === txn.jobId)
    const spentBefore = job?.spentCents ?? 0
    txn.status = 'declined'
    txn.declineReason = 'Declined by owner via dashboard'

    if (job && job.spentCents !== spentBefore) {
      throw new Error('Declined purchase must not change job spend')
    }

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

  async recordLiveAgentSetup(): Promise<VirtualCard> {
    await delay(500)
    const job = snapshot.jobs.find((j) => j.id === DEMO_JOB_ID)
    if (!job) throw new Error('Demo job not found')

    const issuedAt = new Date()
    const card = issueLiveDemoCard(issuedAt)

    if (!liveDemoSession.setupRecorded) {
      snapshot.activities.unshift(
        {
          id: uid('act'),
          type: 'sms',
          title: 'Live Agent Demo — inbound SMS',
          description: LIVE_AGENT_SMS,
          timestamp: issuedAt.toISOString(),
          jobId: DEMO_JOB_ID,
          meta: { simulated: 'true', source: 'live-demo' },
        },
        {
          id: uid('act'),
          type: 'card_issued',
          title: 'Live Agent Demo — sandbox card issued',
          description: `Card •••• ${card.lastFour} — ${formatUsd(card.spendLimitCents)} cap (approved request) for ${PARSED_REQUEST.jobCode}`,
          timestamp: issuedAt.toISOString(),
          jobId: DEMO_JOB_ID,
          meta: { simulated: 'true', source: 'live-demo' },
        },
        {
          id: uid('act'),
          type: 'policy_check',
          title: 'Live Agent Demo — policy passed',
          description: `Deterministic policy approved ${formatUsd(PARSED_REQUEST.amountCents)} for ${PARSED_REQUEST.jobLabel}`,
          timestamp: issuedAt.toISOString(),
          jobId: DEMO_JOB_ID,
          meta: { simulated: 'true', source: 'live-demo' },
        },
      )
      liveDemoSession.setupRecorded = true
    }

    return structuredClone(card)
  },

  async runLiveAgentPurchase(
    variant: 'allowed' | 'blocked',
  ): Promise<SimulatePurchaseResult> {
    if (liveDemoSession.purchaseInFlight) {
      throw new DuplicatePurchaseError('A purchase is already being processed')
    }
    if (variant === 'allowed' && liveDemoSession.allowedPurchaseSettled) {
      throw new DuplicatePurchaseError('This single-use card has already been used')
    }
    if (!liveDemoSession.issuedCardId) {
      throw new Error('Issue the sandbox card before simulating a purchase')
    }

    liveDemoSession.purchaseInFlight = true
    await delay(700)

    try {
      const purchase = variant === 'allowed' ? ALLOWED_PURCHASE : BLOCKED_PURCHASE
      const result = applyPurchaseToSnapshot(
        {
          jobId: DEMO_JOB_ID,
          workerId: DEMO_WORKER_ID,
          merchant: purchase.merchant,
          category: purchase.category,
          amountCents: purchase.amountCents,
        },
        { isSimulated: true, source: 'live-demo' },
      )

      if (
        variant === 'allowed' &&
        (result.transaction.status === 'simulated' ||
          result.transaction.status === 'approved')
      ) {
        liveDemoSession.allowedPurchaseSettled = true
      }

      return result
    } finally {
      liveDemoSession.purchaseInFlight = false
    }
  },

  async resetDemo(): Promise<void> {
    await delay(200)
    snapshot = structuredClone(initialSnapshot)
    resetLiveDemoSession()
  },

  /** @internal test hook */
  _setSnapshotForTests(next: DashboardSnapshot): void {
    snapshot = structuredClone(next)
    resetLiveDemoSession()
  },

  _getSnapshotMutableForTests(): DashboardSnapshot {
    return snapshot
  },
}
