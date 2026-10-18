import { formatCurrencyPrecise } from '../lib/format'
import { PARSED_REQUEST } from './liveAgentScenario'

/** Display copy for animated SMS (simulated — not live Photon). */
export const SMS_WORKER_MESSAGE =
  'Hey Fieldcard, need $186.50 in fittings for Henderson at Ferguson.'

export const SMS_AGENT_CHECKING =
  'Got it, Mike. Checking the Henderson job and spending rules now.'

export const SMS_AGENT_APPROVED = `Approved. Your single-use card is ready for ${formatCurrencyPrecise(
  PARSED_REQUEST.amountCents,
)} at approved plumbing suppliers. Expires in 4 hours.`

export const DEMO_CONTEXT = {
  company: 'Ballard Plumbing & Heat',
  worker: 'Mike',
  workerId: 'w_mike',
  job: 'HEN-1042',
  merchant: PARSED_REQUEST.merchant,
  mcc: PARSED_REQUEST.mcc,
  amountLabel: formatCurrencyPrecise(PARSED_REQUEST.amountCents),
  workerLimit: '$300',
  jobBudgetRemaining: '$790',
}

export type PhoneConversationPhase =
  | 'intro'
  | 'worker-sms'
  | 'typing-check'
  | 'agent-checking'
  | 'policy-processing'
  | 'agent-approved'
  | 'card-revealed'
  | 'purchase-approved'
  | 'purchase-declined'

export function liveDemoStepToPhonePhase(
  step: number,
  purchaseOutcome?: 'approved' | 'declined' | null,
): PhoneConversationPhase {
  if (step === 0) return 'intro'
  if (step === 1) return 'worker-sms'
  if (step === 2) return 'agent-checking'
  if (step === 3) return 'policy-processing'
  if (step === 4) return 'card-revealed'
  if (step === 5) {
    if (purchaseOutcome === 'declined') return 'purchase-declined'
    if (purchaseOutcome === 'approved') return 'purchase-approved'
    return 'card-revealed'
  }
  return 'intro'
}
