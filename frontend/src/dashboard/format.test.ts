import { describe, expect, it } from 'vitest'
import { amountFromMessage, describeActivity, flagText, usd, usedPercent } from './format'

describe('dashboard format', () => {
  it('reads the amount from an activity message', () => {
    expect(amountFromMessage('Mike spent $1,160.50 at Ferguson')).toBe(1160.5)
    expect(amountFromMessage('Card ending 4417 issued: $200.00 cap at Ferguson, 4h')).toBe(200)
    expect(amountFromMessage('Receipt from Ferguson: all items match the plan')).toBeNull()
  })

  it('maps backend activity kinds to badges', () => {
    expect(describeActivity('card_issued', 'Card ending 1 issued').badge).toEqual({ label: 'Issued', tone: 'issued' })
    expect(describeActivity('purchase_declined', 'Mike declined at Home Depot').badge.tone).toBe('declined')
    expect(describeActivity('approval_requested', 'Owner asked').badge.label).toBe('Awaiting owner')
    expect(describeActivity('request', 'Mike requested $600.00 at Ferguson (waiting_for_owner)').badge.label).toBe('Awaiting owner')
    expect(describeActivity('request', 'Mike requested $60.00 at Ferguson (denied)').badge.label).toBe('Declined')
    expect(describeActivity('receipt', 'Receipt from Ferguson: flagged Snacks').badge.label).toBe('Flagged')
    expect(describeActivity('approval_decided', "Dana denied Mike's request").badge.label).toBe('Declined')
  })

  it('formats money, usage and receipt flags', () => {
    expect(usd(1610)).toBe('$1,610.00')
    expect(usd(1610, 0)).toBe('$1,610')
    expect(usedPercent(1380, 1400)).toBeGreaterThan(90)
    expect(flagText({ item: 'Snacks', why: 'not planned' })).toBe('Snacks: not planned')
    expect(flagText('Pipe cutter')).toBe('Pipe cutter')
  })
})
