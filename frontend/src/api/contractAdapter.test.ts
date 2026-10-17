import { describe, expect, it } from 'vitest'
import { toSimulatePurchaseResponse } from './contractAdapter'

describe('toSimulatePurchaseResponse', () => {
  it('maps approved evaluation to contract shape', () => {
    expect(
      toSimulatePurchaseResponse({
        approved: true,
        status: 'approved',
        rules: [],
        summary: 'ok',
      }),
    ).toEqual({ result: 'approved', decline_reason: null })
  })

  it('maps mcc decline to contract shape', () => {
    const res = toSimulatePurchaseResponse({
      approved: false,
      status: 'declined',
      rules: [],
      summary: 'MCC 5200 is not in allowed_mccs [5074, 5251]',
      declineReason: 'MCC 5200 is not in allowed_mccs [5074, 5251]',
    })
    expect(res.result).toBe('declined')
    expect(res.decline_reason).toContain('5200')
  })
})
