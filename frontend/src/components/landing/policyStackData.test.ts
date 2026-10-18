import { describe, expect, it } from 'vitest'
import { STACK_CARDS } from './policyStackData'

describe('landing policy stack examples', () => {
  const byId = Object.fromEntries(STACK_CARDS.map((card) => [card.id, card]))

  it('shows the approved Ferguson purchase at $186.50 under MCC 5074', () => {
    expect(byId.approved).toMatchObject({
      merchant: 'Ferguson Plumbing Supply',
      amount: '$186.50',
      reason: 'MCC 5074 · Within spending limits',
    })
    expect(byId.approved.job).toContain('HEN-1042')
  })

  it('shows the declined Home Depot Pro purchase at $89.00 under MCC 5200', () => {
    expect(byId.declined).toMatchObject({
      merchant: 'Home Depot Pro',
      amount: '$89.00',
      reason: 'MCC 5200 · Not an allowed category',
    })
  })

  it('shows the $275.00 Ferguson purchase awaiting owner approval above $250', () => {
    expect(byId.review).toMatchObject({
      merchant: 'Ferguson Plumbing Supply',
      amountCents: 27_500,
      amount: '$275.00',
      reason: 'Above the $250 approval threshold',
    })
  })

  it('never communicates a status by colour alone', () => {
    expect(STACK_CARDS.map((card) => card.label)).toEqual(['Approved', 'Declined', 'Needs approval'])
  })
})
