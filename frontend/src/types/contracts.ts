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
