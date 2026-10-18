import { beforeEach, describe, expect, it } from 'vitest'
import { initialSnapshot } from '../data/mockData'
import { MCC_HOME_IMPROVEMENT } from '../data/merchants'
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
    const before = (await fieldcardApi.getJob('job_henderson'))!

    await fieldcardApi.runLiveAgentPurchase('blocked')
    const afterDecline = (await fieldcardApi.getJob('job_henderson'))!
    expect(afterDecline.spentCents).toBe(before.spentCents)

    await fieldcardApi.runLiveAgentPurchase('allowed')
    const afterApprove = (await fieldcardApi.getJob('job_henderson'))!
    expect(afterApprove.spentCents).toBe(161_000 + 18_650)
    expect(afterApprove.materialBudgetCents - afterApprove.spentCents).toBe(60_350)
  })

  it('declines Home Depot using MCC restriction', async () => {
    await fieldcardApi.recordLiveAgentSetup()
    const result = await fieldcardApi.runLiveAgentPurchase('blocked')
    expect(result.transaction.mcc).toBe(MCC_HOME_IMPROVEMENT)
    expect(result.transaction.status).toBe('declined')
    expect(result.transaction.declineReason).toContain('5200')
    expect(result.transaction.declineReason).toContain('allowed_mccs')
    expect(result.policyDecision.summary).toContain('5200')
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

    const job = await fieldcardApi.getJob('job_henderson')
    expect(job?.spentCents).toBe(initialSnapshot.jobs[0].spentCents)
    expect(fieldcardApi.getLiveDemoCard()).toBeUndefined()

    const snap = await fieldcardApi.getSnapshot()
    const henCard = snap.cards.find((c) => c.id === 'card_hen')
    expect(henCard?.status).toBe('active')
    expect(snap.workers[0].id).toBe('w_mike')
  })
})

describe('fieldcardApi spend consistency', () => {
  const totals = async () => {
    const snap = await fieldcardApi.getSnapshot()
    const jobSpend = snap.jobs.reduce((sum, j) => sum + j.spentCents, 0)
    const hen = snap.jobs.find((j) => j.id === 'job_henderson')!
    return { metric: snap.metrics.totalMaterialSpendCents, jobSpend, hen, snap }
  }

  it('keeps totalMaterialSpendCents equal to job spend through the canonical sequence', async () => {
    let t = await totals()
    expect(t.metric).toBe(t.jobSpend)
    expect(t.hen.spentCents).toBe(161_000)

    // Live Demo: $186.50 Ferguson approved
    await fieldcardApi.recordLiveAgentSetup()
    await fieldcardApi.runLiveAgentPurchase('allowed')
    t = await totals()
    expect(t.hen.spentCents).toBe(179_650)
    expect(t.hen.materialBudgetCents - t.hen.spentCents).toBe(60_350)
    expect(t.metric).toBe(t.jobSpend)

    // Owner approves the pending $275 Ferguson purchase
    const pending = t.snap.transactions.find((x) => x.status === 'pending' && x.amountCents === 27_500)!
    await fieldcardApi.approveTransaction(pending.id)
    t = await totals()
    expect(t.hen.spentCents).toBe(207_150)
    expect(t.hen.materialBudgetCents - t.hen.spentCents).toBe(32_850)
    expect(t.metric).toBe(t.jobSpend)

    await fieldcardApi.resetDemo()
    t = await totals()
    expect(t.hen.spentCents).toBe(161_000)
    expect(t.metric).toBe(initialSnapshot.metrics.totalMaterialSpendCents)
    expect(t.metric).toBe(t.jobSpend)
  })

  it('leaves both job spend and the total untouched when the owner declines', async () => {
    const before = await totals()
    const pending = before.snap.transactions.find((x) => x.status === 'pending')!
    await fieldcardApi.declineTransaction(pending.id)
    const after = await totals()
    expect(after.jobSpend).toBe(before.jobSpend)
    expect(after.metric).toBe(before.metric)
  })
})
