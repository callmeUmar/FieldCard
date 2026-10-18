import { describe, expect, it } from 'vitest'
import {
  CARD_VALIDITY_MS,
  cardDeclineReason,
  computeCardExpiresAt,
  isCardExpired,
  isCardSpendable,
} from './cardLifecycle'
import type { VirtualCard } from '../types'

function baseCard(overrides: Partial<VirtualCard> = {}): VirtualCard {
  const issuedAt = new Date('2026-01-01T12:00:00.000Z')
  return {
    id: 'c1',
    jobId: 'job_1',
    lastFour: '1234',
    spendLimitCents: 18_650,
    allowedMccs: ['5074'],
    issuedAt: issuedAt.toISOString(),
    expiresAt: computeCardExpiresAt(issuedAt),
    status: 'active',
    ...overrides,
  }
}

describe('cardLifecycle', () => {
  it('expires exactly 4 hours after issuance', () => {
    const issued = Date.parse('2026-01-01T12:00:00.000Z')
    const expires = Date.parse(computeCardExpiresAt(issued))
    expect(expires - issued).toBe(CARD_VALIDITY_MS)
  })

  it('detects expiration', () => {
    const card = baseCard()
    const beforeExpiry = Date.parse(card.expiresAt) - 1
    const afterExpiry = Date.parse(card.expiresAt) + 1
    expect(isCardExpired(card.expiresAt, beforeExpiry)).toBe(false)
    expect(isCardExpired(card.expiresAt, afterExpiry)).toBe(true)
  })

  it('marks used cards as not spendable', () => {
    const used = baseCard({ status: 'used', singleUse: true })
    expect(isCardSpendable(used)).toBe(false)
    expect(cardDeclineReason(used, 18_650)).toMatch(/already consumed/i)
  })

  it('enforces spend cap in cents', () => {
    const issued = new Date()
    const card = baseCard({
      spendLimitCents: 18_650,
      issuedAt: issued.toISOString(),
      expiresAt: computeCardExpiresAt(issued),
    })
    expect(cardDeclineReason(card, 18_651, issued.getTime())).toMatch(
      /exceeds card spend cap/i,
    )
    expect(cardDeclineReason(card, 18_650, issued.getTime())).toBeUndefined()
  })
})
