/**
 * Shapes aligned with `contracts.md` on origin/setup (Umar backend).
 * Dashboard UI uses camelCase adapters in `src/types/index.ts`.
 */

export type CardState = 'active' | 'used' | 'expired' | 'terminated'
export type PurchaseResult = 'approved' | 'declined'
export type ApprovalStatus = 'pending' | 'approved' | 'denied'

export interface InboundMessage {
  from_phone: string
  text: string
  image_url: string | null
}

export interface CompanyDocument {
  _id: string
  name: string
  owner_name: string
  owner_phone: string
  approval_threshold_usd: number
}

export interface WorkerDocument {
  _id: string
  company_id: string
  name: string
  phone: string
  per_purchase_limit_usd: number
  offer?: string
}

export interface JobDocument {
  _id: string
  company_id: string
  code: string
  name: string
  aliases: string[]
  materials_budget_usd: number
  spent_usd: number
  quoted_price_usd: number
  planned_materials: string[]
  status: string
}

export interface MerchantDocument {
  _id: string
  name: string
  mcc: string
}

export interface CardDocument {
  _id: string
  request_id: string
  worker_id: string
  last4: string
  allowed_mccs: string[]
  amount_cap_usd: number
  expires_at: string
  state: CardState
}

export interface SimulatePurchaseRequest {
  card_id: string
  merchant_name: string
  mcc: string
  amount: number
}

export interface SimulatePurchaseResponse {
  result: PurchaseResult
  decline_reason: string | null
}

export interface TransactionDocument {
  _id: string
  card_id: string
  job_id: string
  merchant_name: string
  mcc: string
  amount_usd: number
  result: PurchaseResult
  decline_reason: string | null
  occurred_at: string
}

/* ---------- Dashboard read API (backend/main.py, read-only) ---------- */

export interface ActivityDocument {
  _id: string
  at: string
  kind: string
  message: string
  job_id: string | null
}

export interface PolicyResultDocument {
  allowed: boolean
  needs_owner: boolean
  reasons: string[]
}

export interface RequestDocument {
  _id: string
  worker_id: string
  job_id: string | null
  merchant: string
  mcc: string
  items: string
  est_amount_usd: number
  original_text: string
  policy: PolicyResultDocument
  status: string
  created_at: string
  card_id?: string
}

export interface ApprovalDocument {
  _id: string
  request_id: string
  owner_phone: string | null
  status: ApprovalStatus
  created_at: string
  decided_at: string | null
  request: RequestDocument | null
}

export interface ReceiptDocument {
  _id: string
  transaction_id: string | null
  job_id: string
  store: string | null
  items: unknown[]
  total: number | null
  flags: unknown[]
  ocr_source: string | null
}

export interface LiveCardDocument extends CardDocument {
  job_id: string | null
}

export interface LiveJobDocument extends JobDocument {
  remaining_usd: number
  committed_usd: number
}

export interface PublicCompanyDocument {
  _id: string
  name: string
  owner_name: string
  owner_phone: string | null
  approval_threshold_usd: number
}

export interface DashboardResponse {
  company: PublicCompanyDocument
  workers: WorkerDocument[]
  merchants: MerchantDocument[]
  jobs: LiveJobDocument[]
  cards: LiveCardDocument[]
  requests: RequestDocument[]
  approvals: ApprovalDocument[]
  transactions: TransactionDocument[]
  receipts: ReceiptDocument[]
  activity: ActivityDocument[]
}

export interface BurnPoint {
  at: string
  spent_usd: number
  amount_usd: number | null
  merchant_name: string | null
}

export interface BurnResponse {
  job_id: string
  budget_usd: number
  spent_usd: number
  baseline_usd: number
  points: BurnPoint[]
}

/** POST /api/simulate/purchase body (backend uses the worker's active card) */
export interface LivePurchaseRequest {
  worker_id: string
  merchant_name: string
  amount: number
}

export interface LivePurchaseResponse extends SimulatePurchaseResponse {
  status: PurchaseResult
  reason: string | null
  message?: string
  transaction_id?: string
  card_id?: string
}

/** POST /api/dev/request-card (dashboard Live Agent Demo, dev-only) */
export interface DemoCardRequest {
  worker_id: string
  job_id: string
  merchant_name: string
  amount_usd: number
  items: string
  text: string
}

export interface DemoCardResponse {
  status: 'issued' | 'waiting_for_owner' | 'denied'
  reasons?: string[]
  store?: string
  card: LiveCardDocument | null
}
