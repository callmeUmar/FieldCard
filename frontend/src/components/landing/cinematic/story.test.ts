import { describe, expect, it } from 'vitest'
import { PARSED_REQUEST } from '../../../demo/liveAgentScenario'
import { DEMO_CONTEXT } from '../../../demo/smsConversation'
import { AMOUNT, BEATS, CARD_COPY, DECISION_META, JOB_IMPACT, SCREEN_COPY } from './story'

/** Every financial value the landing story displays must match the canonical scenario. */
describe('cinematic story copy', () => {
  const specs = Object.fromEntries(CARD_COPY.specs.map((row) => [row.label, row.value]))

  it('shows the exact requested and approved amount: $186.50', () => {
    expect(PARSED_REQUEST.amountCents).toBe(18_650)
    expect(AMOUNT).toBe('$186.50')
    expect(SCREEN_COPY.request).toContain('$186.50')
    expect(SCREEN_COPY.approved).toContain('$186.50')
    expect(specs['Spend cap']).toBe('$186.50')
  })

  it('locks the card to HEN-1042, MCC 5074, a 4-hour expiry and a single use', () => {
    expect(specs.Job).toContain('HEN-1042')
    expect(specs.Merchant).toContain('MCC 5074')
    expect(specs.Expires).toContain('4 hours')
    expect(specs.Use).toBe('Single-use')
    expect(SCREEN_COPY.approved).toContain('4 hours')
  })

  it('evaluates the $300 worker limit and MCC 5074 at Ferguson', () => {
    expect(DEMO_CONTEXT.workerLimit).toBe('$300')
    expect(SCREEN_COPY.policyChecks).toEqual(['Budget', '$300 limit', 'MCC 5074'])
    expect(BEATS.policy.body).toContain('$300')
    expect(BEATS.policy.body).toContain('HEN-1042')
    expect(SCREEN_COPY.request).toContain('Ferguson')
    expect(DECISION_META).toContain('Ferguson')
    expect(DECISION_META).toContain('MCC 5074')
  })

  it('shows the HEN-1042 budget impact of exactly one $186.50 purchase, in integer cents', () => {
    expect(JOB_IMPACT.code).toBe('HEN-1042')
    expect(JOB_IMPACT.cents).toEqual({
      budget: 240_000,
      spentBefore: 161_000,
      spentAfter: 179_650,
      remainingBefore: 79_000,
      remainingAfter: 60_350,
    })
    expect(JOB_IMPACT.cents.spentAfter - JOB_IMPACT.cents.spentBefore).toBe(PARSED_REQUEST.amountCents)
    expect(JOB_IMPACT.spentBefore).toBe('$1,610.00')
    expect(JOB_IMPACT.spentAfter).toBe('$1,796.50')
    expect(JOB_IMPACT.remainingBefore).toBe('$790.00')
    expect(JOB_IMPACT.remainingAfter).toBe('$603.50')
    expect(JOB_IMPACT.budget).toBe('$2,400.00')
    expect([JOB_IMPACT.usedBeforeLabel, JOB_IMPACT.usedAfterLabel]).toEqual(['67%', '75%'])
    expect(BEATS.payoff.title).toBe('Every purchase, tied to the right job.')
  })
})
