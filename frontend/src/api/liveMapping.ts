/**
 * Maps the backend's documents (snake_case, dollars, contracts.md) onto the
 * dashboard's view types (camelCase, cents). Pure functions, no I/O.
 */
import type {
  ActivityDocument,
  BurnResponse,
  DashboardResponse,
  LiveCardDocument,
  LiveJobDocument,
  ReceiptDocument,
  RequestDocument,
  TransactionDocument,
} from '../types/contracts'
import type {
  ActivityItem,
  DashboardSnapshot,
  Job,
  PolicyDecision,
  PolicyRuleHit,
  Receipt,
  Transaction,
  VirtualCard,
} from '../types'

const CARD_HOURS = 4
const cents = (usd: number | null | undefined) => Math.round((usd ?? 0) * 100)

export const policyIdForRequest = (requestId: string) => `pol_${requestId}`
export const policyIdForTransaction = (txnId: string) => `pol_${txnId}`

export function toVirtualCard(c: LiveCardDocument, now = Date.now()): VirtualCard {
  const expired = new Date(c.expires_at).getTime() <= now
  const status: VirtualCard['status'] =
    c.state === 'used' ? 'used' : c.state === 'terminated' ? 'frozen' : c.state === 'expired' || expired ? 'expired' : 'active'
  return {
    id: c._id,
    jobId: c.job_id ?? '',
    lastFour: c.last4,
    spendLimitCents: cents(c.amount_cap_usd),
    allowedMccs: c.allowed_mccs,
    // Cards don't store an issue time; every card lasts CARD_HOURS.
    issuedAt: new Date(new Date(c.expires_at).getTime() - CARD_HOURS * 3_600_000).toISOString(),
    expiresAt: c.expires_at,
    status,
    singleUse: true,
  }
}

function toJob(j: LiveJobDocument, assignedWorkerId: string): Job {
  return {
    id: j._id,
    code: j.code,
    customerName: j.name,
    address: '',
    trade: 'plumbing',
    status: j.status === 'completed' ? 'completed' : j.status === 'active' ? 'active' : 'on_hold',
    assignedWorkerId,
    materialBudgetCents: cents(j.materials_budget_usd),
    spentCents: cents(j.spent_usd),
    committedCents: cents(j.committed_usd),
    startedAt: new Date().toISOString(),
    notes: j.planned_materials?.length ? `Planned materials: ${j.planned_materials.join(', ')}` : undefined,
  }
}

/** Backend policy reasons -> the dashboard's rule list (same ids as lib/policyEngine) */
export function rulesFromPolicy(req: RequestDocument): PolicyRuleHit[] {
  const reasons = req.policy?.reasons ?? []
  const hit = (pattern: RegExp) => reasons.find((r) => pattern.test(r))
  const rule = (ruleId: string, title: string, description: string, pattern: RegExp): PolicyRuleHit => {
    const detail = hit(pattern)
    return { ruleId, title, description, passed: !detail, detail }
  }
  return [
    rule('r-job-active', 'Job exists & active', 'Purchases must be tied to an active job', /no matching job|is not active|different company/i),
    rule('r-card-active', 'One active card per worker', 'A worker can hold one active card at a time', /active card|positive dollar/i),
    rule('r-worker-limit', 'Worker spending limit', 'Transaction cannot exceed worker per-purchase limit', /per-purchase limit/i),
    rule('r-budget', 'Materials budget', 'Spend must not exceed remaining job materials budget', /materials budget/i),
    rule('r-mcc', 'Merchant category (MCC)', 'Store category must be pre-approved', /merchant category/i),
    rule('r-approval', 'Approval threshold', 'Amounts over the company threshold need owner approval', /approval threshold/i),
  ]
}

function requestDecision(req: RequestDocument): PolicyDecision {
  const reasons = req.policy?.reasons ?? []
  return {
    id: policyIdForRequest(req._id),
    jobId: req.job_id ?? '',
    approved: req.policy?.allowed ?? false,
    summary: req.policy?.allowed
      ? 'All policy checks passed'
      : req.policy?.needs_owner
        ? `Needs owner approval: ${reasons.join(' ')}`
        : `Denied: ${reasons.join(' ')}`,
    evaluatedAt: req.created_at,
    rules: rulesFromPolicy(req),
    aiNarrative: req.original_text ? `Worker texted: "${req.original_text}"` : '',
  }
}

/** Card-network decision for one purchase, from the provider's decline reason */
function purchaseDecision(t: TransactionDocument, req: RequestDocument | undefined): PolicyDecision {
  const reason = t.decline_reason ?? ''
  const rule = (ruleId: string, title: string, description: string, pattern: RegExp): PolicyRuleHit => {
    const failed = t.result === 'declined' && pattern.test(reason)
    return { ruleId, title, description, passed: !failed, detail: failed ? reason : undefined }
  }
  return {
    id: policyIdForTransaction(t._id),
    transactionId: t._id,
    jobId: t.job_id,
    approved: t.result === 'approved',
    summary: t.result === 'approved' ? `Approved at ${t.merchant_name}` : `Declined: ${reason || 'declined by the card'}`,
    evaluatedAt: t.occurred_at,
    rules: [
      rule('r-card-active', 'Sandbox card lifecycle', 'Card must be active, unexpired, and not already used', /active|expired|used/i),
      rule('r-mcc', 'Merchant category (MCC)', 'MCC must be listed on the virtual card allowed_mccs', /store|merchant|category/i),
      rule('r-card-limit', 'Virtual card spend cap', 'Transaction must not exceed the issued card cap', /over the|cap|limit/i),
    ],
    aiNarrative: req?.original_text ? `Card requested by text: "${req.original_text}"` : '',
  }
}

const ACTIVITY_TITLES: Record<string, { type: ActivityItem['type']; title: string }> = {
  request: { type: 'sms', title: 'Card request' },
  card_issued: { type: 'card_issued', title: 'Card issued' },
  card_terminated: { type: 'card_issued', title: 'Card cancelled' },
  approval_requested: { type: 'policy_check', title: 'Owner review requested' },
  purchase_approved: { type: 'purchase', title: 'Purchase approved' },
  purchase_declined: { type: 'purchase', title: 'Purchase declined' },
  receipt: { type: 'purchase', title: 'Receipt checked' },
  demo: { type: 'sms', title: 'Demo phone connected' },
}

export function toActivity(a: ActivityDocument): ActivityItem {
  let mapped = ACTIVITY_TITLES[a.kind]
  if (a.kind === 'approval_decided') {
    mapped = { type: 'purchase', title: /denied|declined/i.test(a.message) ? 'Owner declined request' : 'Owner approved request' }
  }
  return {
    id: a._id,
    type: mapped?.type ?? 'policy_check',
    title: mapped?.title ?? a.kind.replace(/_/g, ' ').replace(/^\w/, (ch) => ch.toUpperCase()),
    description: a.message,
    timestamp: a.at,
    jobId: a.job_id ?? undefined,
  }
}

const itemText = (x: unknown): string =>
  typeof x === 'string' ? x : x && typeof x === 'object' ? String((x as Record<string, unknown>).name ?? (x as Record<string, unknown>).item ?? JSON.stringify(x)) : String(x)

const flagText = (x: unknown): string => {
  if (x && typeof x === 'object' && 'item' in x) {
    const f = x as { item: unknown; why?: unknown }
    return f.why ? `${String(f.item)}: ${String(f.why)}` : String(f.item)
  }
  return itemText(x)
}

export function toReceipt(r: ReceiptDocument): Receipt {
  return {
    id: r._id,
    jobId: r.job_id,
    transactionId: r.transaction_id,
    store: r.store ?? 'Unknown store',
    totalCents: r.total == null ? null : cents(r.total),
    items: (r.items ?? []).map(itemText),
    flags: (r.flags ?? []).map(flagText),
  }
}

export function toSnapshot(raw: DashboardResponse, now = Date.now()): DashboardSnapshot {
  const requestsById = new Map(raw.requests.map((r) => [r._id, r]))
  const cardsById = new Map(raw.cards.map((c) => [c._id, c]))
  const cards = raw.cards.map((c) => toVirtualCard(c, now))

  // A job's worker: whoever has requested cards for it, else the first worker.
  const workerForJob = new Map<string, string>()
  for (const r of [...raw.requests].reverse()) if (r.job_id) workerForJob.set(r.job_id, r.worker_id)
  const firstWorker = raw.workers[0]?._id ?? ''
  const jobs = raw.jobs.map((j) => toJob(j, workerForJob.get(j._id) ?? firstWorker))

  const purchases: Transaction[] = raw.transactions.map((t) => {
    const card = cardsById.get(t.card_id)
    return {
      id: t._id,
      jobId: t.job_id,
      workerId: card?.worker_id ?? '',
      merchant: t.merchant_name,
      mcc: t.mcc,
      amountCents: cents(t.amount_usd),
      status: t.result,
      cardLastFour: card?.last4 ?? '••••',
      createdAt: t.occurred_at,
      isSimulated: true,
      policyDecisionId: policyIdForTransaction(t._id),
      declineReason: t.decline_reason ?? undefined,
    }
  })

  // Requests waiting for the owner show up as pending purchases in the approval queue.
  const pendingRequestIds = new Set(raw.approvals.filter((a) => a.status === 'pending').map((a) => a.request_id))
  const pending: Transaction[] = raw.requests
    .filter((r) => r.status === 'waiting_for_owner' && pendingRequestIds.has(r._id))
    .map((r) => ({
      id: r._id,
      jobId: r.job_id ?? '',
      workerId: r.worker_id,
      merchant: r.merchant,
      mcc: r.mcc,
      amountCents: cents(r.est_amount_usd),
      status: 'pending' as const,
      cardLastFour: '••••',
      createdAt: r.created_at,
      isSimulated: true,
      policyDecisionId: policyIdForRequest(r._id),
    }))

  const transactions = [...pending, ...purchases]
  const policyDecisions = [
    ...raw.requests.map(requestDecision),
    ...raw.transactions.map((t) => purchaseDecision(t, requestsById.get(cardsById.get(t.card_id)?.request_id ?? ''))),
  ]
  const settled = purchases.filter((t) => t.status === 'approved' || t.status === 'declined')
  const approved = settled.filter((t) => t.status === 'approved').length

  return {
    source: 'live',
    company: {
      id: raw.company._id,
      name: raw.company.name,
      ownerName: raw.company.owner_name,
      tradeFocus: ['plumbing'],
      timezone: 'America/Los_Angeles',
    },
    workers: raw.workers.map((w) => ({
      id: w._id,
      name: w.name,
      role: 'Field worker',
      phone: w.phone,
      spendingLimitCents: cents(w.per_purchase_limit_usd),
    })),
    jobs,
    merchants: raw.merchants.map((m) => ({ id: m._id, name: m.name, mcc: m.mcc })),
    cards,
    transactions,
    activities: raw.activity.map(toActivity),
    policyDecisions,
    receipts: raw.receipts.map(toReceipt),
    metrics: {
      totalMaterialSpendCents: jobs.reduce((s, j) => s + j.spentCents, 0),
      monthlyBudgetCents: jobs.reduce((s, j) => s + j.materialBudgetCents, 0),
      activeJobs: jobs.filter((j) => j.status === 'active').length,
      pendingApprovals: pending.length,
      approvalRatePercent: settled.length ? Math.round((approved / settled.length) * 100) : 100,
      cardsActive: cards.filter((c) => c.status === 'active').length,
      spendVsLastMonthPercent: 0,
    },
  }
}

/** Store names differ between the bundled catalog and the backend ("Ferguson Plumbing Supply" vs "Ferguson"). */
export function resolveMerchantName(name: string, live: { name: string }[]): string {
  const lower = name.trim().toLowerCase()
  const exact = live.find((m) => m.name.toLowerCase() === lower)
  if (exact) return exact.name
  const prefix = live.find((m) => lower.startsWith(m.name.toLowerCase()))
  return prefix?.name ?? name // unknown stores go through as-is; the backend declines them
}

export interface BurnSeries {
  budgetCents: number
  baselineCents: number
  points: { at: string; spentCents: number; amountCents: number | null; merchant: string | null }[]
}

export function toBurnSeries(b: BurnResponse): BurnSeries {
  return {
    budgetCents: cents(b.budget_usd),
    baselineCents: cents(b.baseline_usd),
    points: b.points.map((p) => ({
      at: p.at,
      spentCents: cents(p.spent_usd),
      amountCents: p.amount_usd == null ? null : cents(p.amount_usd),
      merchant: p.merchant_name,
    })),
  }
}

/** Offline equivalent of /api/jobs/{id}/burn, from bundled data */
export function burnFromSnapshot(snapshot: DashboardSnapshot, jobId: string, now = new Date()): BurnSeries | null {
  const job = snapshot.jobs.find((j) => j.id === jobId)
  if (!job) return null
  const approved = snapshot.transactions
    .filter((t) => t.jobId === jobId && (t.status === 'approved' || t.status === 'simulated'))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const baseline = job.spentCents - approved.reduce((s, t) => s + t.amountCents, 0)
  const start = approved[0] ? new Date(new Date(approved[0].createdAt).getTime() - 3_600_000) : new Date(now.getTime() - 86_400_000)
  let running = baseline
  return {
    budgetCents: job.materialBudgetCents,
    baselineCents: baseline,
    points: [
      { at: start.toISOString(), spentCents: baseline, amountCents: null, merchant: null },
      ...approved.map((t) => {
        running += t.amountCents
        return { at: t.createdAt, spentCents: running, amountCents: t.amountCents, merchant: t.merchant }
      }),
      { at: now.toISOString(), spentCents: job.spentCents, amountCents: null, merchant: null },
    ],
  }
}
