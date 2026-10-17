import { beforeEach, describe, expect, it } from 'vitest'
import { initialSnapshot } from '../data/mockData'
import { PARSED_REQUEST } from '../demo/liveAgentScenario'
import { CARD_VALIDITY_MS } from '../lib/cardLifecycle'
import { DuplicatePurchaseError, fieldcardApi } from './adapter'

beforeEach(async () => {
  await fieldcardApi.resetDemo()
})

describe('fieldcardApi live demo financials', () => {
  it('issues card cap from approved request amount', async () => {
    const card = await fieldcardApi.recordLiveAgentSetup()
    expect(card.spendLimitCents).toBe(PARSED_REQUEST.amountCents)
    expect(card.spendLimitCents).toBe(18_650)
    expect(card.spendLimitCents).not.toBe(30_000)
  })

  it('sets expiration to issuedAt + 4 hours', async () => {
    const card = await fieldcardApi.recordLiveAgentSetup()
    const issued = Date.parse(card.issuedAt)
    const expires = Date.parse(card.expiresAt)
    expect(expires - issued).toBe(CARD_VALIDITY_MS)
  })

  it('updates HEN-1042 budget on approved purchase only', async () => {
    await fieldcardApi.recordLiveAgentSetup()
    const before = (await fieldcardApi.getJob('job-henderson'))!

    await fieldcardApi.runLiveAgentPurchase('blocked')
    const afterDecline = (await fieldcardApi.getJob('job-henderson'))!
    expect(afterDecline.spentCents).toBe(before.spentCents)

    await fieldcardApi.runLiveAgentPurchase('allowed')
    const afterApprove = (await fieldcardApi.getJob('job-henderson'))!
    expect(afterApprove.spentCents).toBe(161_000 + 18_650)
    expect(afterApprove.materialBudgetCents - afterApprove.spentCents).toBe(60_350)
  })

  it('marks single-use card used after approval', async () => {
    await fieldcardApi.recordLiveAgentSetup()
    await fieldcardApi.runLiveAgentPurchase('allowed')
    const card = fieldcardApi.getLiveDemoCard()
    expect(card?.status).toBe('used')
  })

  it('prevents duplicate allowed purchases', async () => {
    await fieldcardApi.recordLiveAgentSetup()
    await fieldcardApi.runLiveAgentPurchase('allowed')
    await expect(fieldcardApi.runLiveAgentPurchase('allowed')).rejects.toBeInstanceOf(
      DuplicatePurchaseError,
    )
  })

  it('resetDemo restores snapshot and card state', async () => {
    await fieldcardApi.recordLiveAgentSetup()
    await fieldcardApi.runLiveAgentPurchase('allowed')
    await fieldcardApi.resetDemo()

    const job = await fieldcardApi.getJob('job-henderson')
    expect(job?.spentCents).toBe(initialSnapshot.jobs[0].spentCents)
    expect(fieldcardApi.getLiveDemoCard()).toBeUndefined()

    const snap = await fieldcardApi.getSnapshot()
    const henCard = snap.cards.find((c) => c.id === 'card-hen')
    expect(henCard?.status).toBe('active')
  })
})
