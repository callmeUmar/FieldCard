import type { SimulatePurchaseResponse } from '../types/contracts'
import type { PurchaseEvaluation } from '../lib/policyEngine'

/**
 * Maps local policy evaluation to CardProvider.simulate_purchase response shape.
 */
export function toSimulatePurchaseResponse(
  evaluation: PurchaseEvaluation,
): SimulatePurchaseResponse {
  if (evaluation.approved) {
    return { result: 'approved', decline_reason: null }
  }
  if (evaluation.status === 'pending') {
    return {
      result: 'declined',
      decline_reason: evaluation.summary,
    }
  }
  return {
    result: 'declined',
    decline_reason: evaluation.declineReason ?? evaluation.summary,
  }
}
