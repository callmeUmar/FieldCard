/**
 * The dashboard's single data source: the deployed backend first, the bundled
 * mock adapter (./adapter) only when the backend is unreachable. Writes go to
 * whichever source the last snapshot came from.
 */
import { fieldcardApi } from './adapter'
import { BackendRequestError, BackendUnavailableError, liveBackend } from './live'
import {
  burnFromSnapshot,
  policyIdForTransaction,
  resolveMerchantName,
  toActivity,
  toBurnSeries,
  toSnapshot,
  toVirtualCard,
  type BurnSeries,
} from './liveMapping'
import {
  ALLOWED_PURCHASE,
  BLOCKED_PURCHASE,
  DEMO_JOB_ID,
  DEMO_WORKER_ID,
  LIVE_AGENT_SMS,
  PARSED_REQUEST,
} from '../demo/liveAgentScenario'
import type {
  ActivityItem,
  DashboardSnapshot,
  DataSource,
  SimulatePurchaseInput,
  SimulatePurchaseResult,
  Transaction,
  VirtualCard,
} from '../types'
import type { LivePurchaseResponse } from '../types/contracts'

/** Owner approvals are made by replying YES/NO to the SMS, not from the dashboard, while live. */
export class ApprovalBySmsError extends Error {
  constructor() {
    super('Owner approvals happen by SMS reply (YES/NO) while connected to the live backend')
    this.name = 'ApprovalBySmsError'
  }
}

let source: DataSource = 'live'
let lastLive: DashboardSnapshot | null = null

const offlineSnapshot = async (): Promise<DashboardSnapshot> => ({ ...(await fieldcardApi.getSnapshot()), source: 'offline' })

function liveMerchant(name: string): string {
  return resolveMerchantName(name, lastLive?.merchants ?? [])
}

async function liveSnapshot(): Promise<DashboardSnapshot> {
  let raw
  try {
    raw = await liveBackend.dashboard()
  } catch (err) {
    // 404: a backend without /api/dashboard yet, or no seeded company. Nothing live to show.
    if (err instanceof BackendRequestError && err.status === 404) throw new BackendUnavailableError(err.message)
    throw err
  }
  const snap = toSnapshot(raw)
  lastLive = snap
  source = 'live'
  return snap
}

/** Turns a /api/simulate/purchase response into the shape the UI renders, using a fresh snapshot. */
function toPurchaseResult(
  res: LivePurchaseResponse,
  snap: DashboardSnapshot,
  fallback: { jobId: string; workerId: string; merchant: string; mcc: string; amountCents: number },
): SimulatePurchaseResult {
  const transaction: Transaction = snap.transactions.find((t) => t.id === res.transaction_id) ?? {
    // e.g. "no_active_card": nothing was recorded, so describe the attempt itself
    id: res.transaction_id ?? `attempt-${Date.now()}`,
    jobId: fallback.jobId,
    workerId: fallback.workerId,
    merchant: fallback.merchant,
    mcc: fallback.mcc,
    amountCents: fallback.amountCents,
    status: res.result,
    cardLastFour: '••••',
    createdAt: new Date().toISOString(),
    isSimulated: true,
    declineReason: res.decline_reason ?? undefined,
  }
  const policyDecision = snap.policyDecisions.find((p) => p.id === policyIdForTransaction(transaction.id)) ?? {
    id: policyIdForTransaction(transaction.id),
    transactionId: transaction.id,
    jobId: transaction.jobId,
    approved: res.result === 'approved',
    summary: res.result === 'approved' ? 'Approved' : `Declined: ${res.decline_reason === 'no_active_card' ? 'no active card for this worker' : res.decline_reason}`,
    evaluatedAt: transaction.createdAt,
    rules: [],
    aiNarrative: '',
  }
  const activity: ActivityItem = snap.activities[0] ?? {
    id: `act-${transaction.id}`,
    type: 'purchase',
    title: res.result === 'approved' ? 'Purchase approved' : 'Purchase declined',
    description: res.message ?? `${transaction.merchant}`,
    timestamp: transaction.createdAt,
  }
  return { transaction, policyDecision, activity }
}

async function livePurchase(workerId: string, jobId: string, merchant: string, mcc: string, amountCents: number) {
  const merchantName = liveMerchant(merchant)
  const res = await liveBackend.simulatePurchase({ worker_id: workerId, merchant_name: merchantName, amount: amountCents / 100 })
  const snap = await liveSnapshot()
  return toPurchaseResult(res, snap, { jobId, workerId, merchant: merchantName, mcc, amountCents })
}

export const dashboardApi = {
  get source(): DataSource {
    return source
  },

  /** Live snapshot, or offline demo data if the backend can't be reached. */
  async getSnapshot(): Promise<DashboardSnapshot> {
    try {
      return await liveSnapshot()
    } catch (err) {
      if (!(err instanceof BackendUnavailableError)) throw err
      source = 'offline'
      return offlineSnapshot()
    }
  },

  /** Newest-first activity, for the 2-second live poll. Null while offline. */
  async getActivity(): Promise<ActivityItem[] | null> {
    if (source !== 'live') return null
    return (await liveBackend.activity()).map(toActivity)
  },

  async getBurn(jobId: string, snapshot: DashboardSnapshot): Promise<BurnSeries | null> {
    if (source === 'live') {
      try {
        return toBurnSeries(await liveBackend.burn(jobId))
      } catch (err) {
        if (!(err instanceof BackendUnavailableError)) throw err
      }
    }
    return burnFromSnapshot(snapshot, jobId)
  },

  async simulatePurchase(input: SimulatePurchaseInput): Promise<SimulatePurchaseResult> {
    if (source === 'offline') return fieldcardApi.simulatePurchase(input)
    const job = lastLive?.jobs.find((j) => j.id === input.jobId)
    const workerId = input.workerId ?? job?.assignedWorkerId ?? DEMO_WORKER_ID
    return livePurchase(workerId, input.jobId, input.merchant, input.mcc, input.amountCents)
  },

  async approveTransaction(transactionId: string): Promise<void> {
    if (source === 'live') throw new ApprovalBySmsError()
    await fieldcardApi.approveTransaction(transactionId)
  },

  async declineTransaction(transactionId: string): Promise<void> {
    if (source === 'live') throw new ApprovalBySmsError()
    await fieldcardApi.declineTransaction(transactionId)
  },

  /** Live Agent Demo, "issue card" step: real policy + card issuing on the backend (no AI). */
  async recordLiveAgentSetup(): Promise<VirtualCard> {
    if (source === 'offline') return fieldcardApi.recordLiveAgentSetup()
    const res = await liveBackend.requestCard({
      worker_id: DEMO_WORKER_ID,
      job_id: DEMO_JOB_ID,
      merchant_name: liveMerchant(PARSED_REQUEST.merchant),
      amount_usd: PARSED_REQUEST.amountCents / 100,
      items: PARSED_REQUEST.materials,
      text: LIVE_AGENT_SMS,
    })
    if (res.status !== 'issued' || !res.card) {
      const why = res.reasons?.join(' ') ?? ''
      throw new Error(res.status === 'waiting_for_owner' ? `Sent to the owner for approval. ${why}` : `Policy denied the card. ${why}`)
    }
    await liveSnapshot()
    return toVirtualCard(res.card)
  },

  /** Live Agent Demo purchase buttons: POST /api/simulate/purchase */
  async runLiveAgentPurchase(variant: 'allowed' | 'blocked'): Promise<SimulatePurchaseResult> {
    if (source === 'offline') return fieldcardApi.runLiveAgentPurchase(variant)
    const p = variant === 'allowed' ? ALLOWED_PURCHASE : BLOCKED_PURCHASE
    return livePurchase(DEMO_WORKER_ID, DEMO_JOB_ID, p.merchant, p.mcc, p.amountCents)
  },

  /** Offline: restores the bundled data. Live: nothing to undo on the server; the next card request replaces the old card. */
  async resetDemo(): Promise<void> {
    if (source === 'offline') await fieldcardApi.resetDemo()
  },
}
