/**
 * Offline fallback, used ONLY when the backend can't be reached (the UI then
 * shows "Offline"). Same shapes as the backend's responses and the same
 * numbers as backend/seed.py, so the dashboard looks the same either way.
 */
import type {
  ActivityDocument,
  ApprovalDocument,
  JobDetailResponse,
  LiveJobDocument,
  OverviewResponse,
  WorkerDocument,
} from '../types/contracts'

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

const job = (
  _id: string,
  code: string,
  name: string,
  budget: number,
  spent: number,
  planned: string[] = [],
): LiveJobDocument => ({
  _id,
  company_id: 'co_ballard',
  code,
  name,
  aliases: [name.split(' ')[0].toLowerCase()],
  materials_budget_usd: budget,
  spent_usd: spent,
  quoted_price_usd: 0,
  planned_materials: planned,
  status: 'active',
  remaining_usd: budget - spent,
  committed_usd: 0,
})

export const OFFLINE_JOBS: LiveJobDocument[] = [
  job('job_chen', 'CHN-01', 'Chen Bathroom', 1800, 420),
  job('job_henderson', 'HEN-01', 'Henderson Repipe', 2400, 1770, ['copper pipe 3/4', 'copper elbows 3/4', 'solder', 'flux', 'shutoff valves']),
  job('job_ortega', 'ORT-01', 'Ortega Water Heater', 1400, 1380),
]

export const OFFLINE_WORKERS: WorkerDocument[] = [
  { _id: 'w_mike', company_id: 'co_ballard', name: 'Mike', phone: '•••-•••-1111', per_purchase_limit_usd: 300 },
]

export const OFFLINE_OVERVIEW: OverviewResponse = {
  spent_usd: OFFLINE_JOBS.reduce((s, j) => s + j.spent_usd, 0),
  budget_usd: OFFLINE_JOBS.reduce((s, j) => s + j.materials_budget_usd, 0),
  cards_issued_today: 1,
  blocked_today: 1,
  tracked_today_usd: 160,
  latest_card: {
    _id: 'card_offline',
    last4: '4417',
    merchant: 'Ferguson',
    job_id: 'job_henderson',
    job_name: 'Henderson Repipe',
    job_code: 'HEN-01',
    amount_cap_usd: 200,
    expires_at: inHours(3.2),
    state: 'used',
    hours_left: 3.2,
  },
}

export const OFFLINE_APPROVALS: ApprovalDocument[] = [
  {
    _id: 'appr_offline',
    request_id: 'req_offline_2',
    owner_phone: '•••-•••-9999',
    status: 'pending',
    created_at: minutesAgo(3),
    decided_at: null,
    request: {
      _id: 'req_offline_2',
      worker_id: 'w_mike',
      job_id: 'job_ortega',
      merchant: 'Ferguson',
      mcc: '5074',
      items: 'water heater expansion tank',
      est_amount_usd: 280,
      original_text: 'Need an expansion tank at Ferguson for Ortega, about $280',
      policy: {
        allowed: false,
        needs_owner: true,
        reasons: [
          "$280.00 is over the job's remaining materials budget of $20.00.",
          "$280.00 is over the company's approval threshold of $250.00.",
        ],
      },
      status: 'waiting_for_owner',
      created_at: minutesAgo(3),
    },
  },
]

export const OFFLINE_ACTIVITY: ActivityDocument[] = [
  { _id: 'a6', at: minutesAgo(3), kind: 'approval_requested', message: "Owner asked to approve Mike: $280.00 is over the company's approval threshold", job_id: 'job_ortega' },
  { _id: 'a5', at: minutesAgo(12), kind: 'receipt', message: 'Receipt from Ferguson: all items match the plan', job_id: 'job_henderson' },
  { _id: 'a4', at: minutesAgo(18), kind: 'purchase_approved', message: 'Mike spent $160.00 at Ferguson', job_id: 'job_henderson' },
  { _id: 'a3', at: minutesAgo(21), kind: 'purchase_declined', message: 'Mike declined at Home Depot ($160.00): this card only works at Ferguson', job_id: 'job_henderson' },
  { _id: 'a2', at: minutesAgo(25), kind: 'card_issued', message: 'Card ending 4417 issued: $200.00 cap at Ferguson, 4h', job_id: 'job_henderson' },
  { _id: 'a1', at: minutesAgo(25), kind: 'request', message: 'Mike requested $160.00 at Ferguson (approved)', job_id: 'job_henderson' },
]

export function offlineJobDetail(jobId: string): JobDetailResponse | null {
  const j = OFFLINE_JOBS.find((x) => x._id === jobId)
  if (!j) return null
  const henderson = jobId === 'job_henderson'
  return {
    ...j,
    cards: [],
    requests: [],
    transactions: henderson
      ? [
          { _id: 't2', card_id: 'card_offline', job_id: jobId, merchant_name: 'Ferguson', mcc: '5074', amount_usd: 160, result: 'approved', decline_reason: null, occurred_at: minutesAgo(18) },
          { _id: 't1', card_id: 'card_offline', job_id: jobId, merchant_name: 'Home Depot', mcc: '5200', amount_usd: 160, result: 'declined', decline_reason: 'this card only works at the approved store type', occurred_at: minutesAgo(21) },
        ]
      : [],
    receipts: henderson
      ? [{ _id: 'r1', transaction_id: 't2', job_id: jobId, store: 'Ferguson', items: [{ name: 'Copper elbow 3/4' }, { name: 'Pipe cutter' }], total: 158.4, flags: [{ item: 'Pipe cutter', why: 'not in the planned materials' }], ocr_source: 'offline' }]
      : [],
  }
}
