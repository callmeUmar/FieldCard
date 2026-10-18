import type { VirtualCard } from '../types'

/** Sandbox cards expire 4 hours after issuance */
export const CARD_VALIDITY_MS = 4 * 60 * 60 * 1000

export function computeCardExpiresAt(issuedAt: Date | number): string {
  const t = typeof issuedAt === 'number' ? issuedAt : issuedAt.getTime()
  return new Date(t + CARD_VALIDITY_MS).toISOString()
}

export function isCardExpired(expiresAt: string, nowMs = Date.now()): boolean {
  return Date.parse(expiresAt) <= nowMs
}

export function isCardSpendable(card: VirtualCard, nowMs = Date.now()): boolean {
  if (card.status === 'used') return false
  if (card.status !== 'active') return false
  return !isCardExpired(card.expiresAt, nowMs)
}

export function cardDeclineReason(
  card: VirtualCard,
  amountCents: number,
  nowMs = Date.now(),
): string | undefined {
  if (card.status === 'used') return 'Single-use sandbox card already consumed'
  if (card.status !== 'active') return 'Sandbox card is not active'
  if (isCardExpired(card.expiresAt, nowMs)) return 'Sandbox card has expired'
  if (amountCents > card.spendLimitCents) {
    return `Amount exceeds card spend cap (${card.spendLimitCents} cents)`
  }
  return undefined
}
