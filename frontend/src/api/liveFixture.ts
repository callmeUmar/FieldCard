import type { DashboardResponse } from '../types/contracts'

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString()
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

/** A /api/dashboard response shaped like the seeded backend, for tests */
export function dashboardFixture(): DashboardResponse {
  return {
    company: { _id: 'co_ballard', name: 'Ballard Plumbing & Heat', owner_name: 'Dana', owner_phone: '•••-•••-9999', approval_threshold_usd: 250 },
    workers: [{ _id: 'w_mike', company_id: 'co_ballard', name: 'Mike', phone: '•••-•••-1111', per_purchase_limit_usd: 300 }],
    merchants: [
      { _id: 'm_ace', name: 'Ace Hardware', mcc: '5251' },
      { _id: 'm_ferguson', name: 'Ferguson', mcc: '5074' },
      { _id: 'm_home_depot', name: 'Home Depot', mcc: '5200' },
    ],
    jobs: [
      {
        _id: 'job_henderson', company_id: 'co_ballard', code: 'HEN-01', name: 'Henderson Repipe', aliases: ['henderson'],
        materials_budget_usd: 2400, spent_usd: 1670, quoted_price_usd: 7200, planned_materials: ['copper pipe 3/4', 'solder'],
        status: 'active', remaining_usd: 730, committed_usd: 0,
      },
    ],
    cards: [
      { _id: 'card_used', request_id: 'req_1', worker_id: 'w_mike', last4: '0377', allowed_mccs: ['5074'], amount_cap_usd: 75, expires_at: inHours(3), state: 'used', job_id: 'job_henderson' },
      { _id: 'card_old', request_id: 'req_0', worker_id: 'w_mike', last4: '1111', allowed_mccs: ['5074'], amount_cap_usd: 50, expires_at: inHours(-1), state: 'active', job_id: 'job_henderson' },
    ],
    requests: [
      {
        _id: 'req_2', worker_id: 'w_mike', job_id: 'job_henderson', merchant: 'Home Depot', mcc: '5200', items: 'pipe cutter',
        est_amount_usd: 600, original_text: 'need a pipe cutter', status: 'waiting_for_owner', created_at: at(1),
        policy: { allowed: false, needs_owner: true, reasons: ['$600.00 is over the company\'s approval threshold of $250.00.', 'Merchant category 5200 is not pre-approved.'] },
      },
      {
        _id: 'req_1', worker_id: 'w_mike', job_id: 'job_henderson', merchant: 'Ferguson', mcc: '5074', items: 'PEX',
        est_amount_usd: 60, original_text: 'Need $60 of PEX at Ferguson', status: 'issued', created_at: at(30),
        policy: { allowed: true, needs_owner: false, reasons: [] },
      },
    ],
    approvals: [{ _id: 'appr_1', request_id: 'req_2', owner_phone: '•••-•••-9999', status: 'pending', created_at: at(1), decided_at: null, request: null }],
    transactions: [
      { _id: 'txn_ok', card_id: 'card_used', job_id: 'job_henderson', merchant_name: 'Ferguson', mcc: '5074', amount_usd: 60, result: 'approved', decline_reason: null, occurred_at: at(10) },
      { _id: 'txn_no', card_id: 'card_used', job_id: 'job_henderson', merchant_name: 'Home Depot', mcc: '5200', amount_usd: 60, result: 'declined', decline_reason: 'this card only works at the approved store type', occurred_at: at(20) },
    ],
    receipts: [
      { _id: 'rcpt_1', transaction_id: 'txn_ok', job_id: 'job_henderson', store: 'Ferguson', total: 42.18, ocr_source: 'gemini-vision',
        items: [{ name: 'Copper elbow 3/4', qty: 10, price: 18.4 }, { name: 'Snacks', qty: 1, price: 4 }],
        flags: [{ item: 'Snacks', why: 'not a planned material' }] },
    ],
    activity: [
      { _id: 'act_3', at: at(1), kind: 'approval_requested', message: 'Owner asked to approve Mike', job_id: 'job_henderson' },
      { _id: 'act_2', at: at(10), kind: 'purchase_approved', message: 'Mike spent $60.00 at Ferguson', job_id: 'job_henderson' },
      { _id: 'act_1', at: at(20), kind: 'purchase_declined', message: 'Mike declined at Home Depot', job_id: 'job_henderson' },
    ],
  }
}
