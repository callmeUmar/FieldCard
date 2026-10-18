import { describe, expect, it } from 'vitest'
import { AUTO_APPROVE_THRESHOLD_CENTS } from '../lib/policyEngine'
import { initialSnapshot } from './mockData'

const { transactions, workers, jobs, cards, policyDecisions, activities } = initialSnapshot
const job = (code: string) => jobs.find((j) => j.code === code)!
const remaining = (j: (typeof jobs)[number]) => j.materialBudgetCents - j.spentCents - j.committedCents
const cardFor = (t: (typeof transactions)[number]) => cards.find((c) => c.jobId === t.jobId && c.lastFour === t.cardLastFour)!
const ms = (iso: string) => Date.parse(iso)
const dollars = (text: string) => Math.round(Number(text.replace(/[$,]/g, '')) * 100)

/** Approved, non-simulated history across every job */
const approved = transactions.filter((t) => t.status === 'approved' && !t.isSimulated)

describe('seed history is consistent with recorded policy (all jobs)', () => {
  it('covers approved purchases on every job', () => {
    expect(new Set(approved.map((t) => t.jobId))).toEqual(new Set(jobs.map((j) => j.id)))
  })

  it('auto-approved purchases fit the worker limit, the card cap and the approval threshold', () => {
    for (const txn of approved) {
      const worker = workers.find((w) => w.id === txn.workerId)!
      const ownerApproved = activities.some((a) => a.transactionId === txn.id && a.title.startsWith('Owner approved'))
      expect(txn.amountCents, `${txn.id} vs ${worker.name}'s limit`).toBeLessThanOrEqual(worker.spendingLimitCents)
      expect(txn.amountCents, `${txn.id} vs card cap`).toBeLessThanOrEqual(cardFor(txn).spendLimitCents)
      if (!ownerApproved) expect(txn.amountCents, `${txn.id} vs auto-approve threshold`).toBeLessThanOrEqual(AUTO_APPROVE_THRESHOLD_CENTS)
    }
  })

  it('"remaining after purchase" never sits below today\'s remaining budget (spend only grows)', () => {
    for (const txn of approved) {
      const rule = policyDecisions.find((p) => p.id === txn.policyDecisionId)?.rules.find((r) => r.ruleId === 'r-budget')
      const match = rule?.detail?.match(/^(\$[\d,]+\.\d{2}) remaining after purchase$/)
      if (!match) continue
      const j = jobs.find((x) => x.id === txn.jobId)!
      expect(dollars(match[1]), `${txn.id} budget detail`).toBeGreaterThanOrEqual(remaining(j))
    }
  })

  it('records the corrected purchases and keeps their activity text in step', () => {
    expect(transactions.find((t) => t.id === 'txn-1')).toMatchObject({ workerId: 'w_mike', amountCents: 22_890 })
    expect(transactions.find((t) => t.id === 'txn-2')).toMatchObject({ workerId: 'w_priya', amountCents: 18_400 })
    expect(activities.find((a) => a.transactionId === 'txn-1')!.description).toContain('$228.90')
  })
})

describe('seed chronology', () => {
  it('approved authorizations happen while their card is valid', () => {
    for (const txn of approved) {
      const card = cardFor(txn)
      expect(ms(txn.createdAt), `${txn.id} after card ${card.lastFour} issued`).toBeGreaterThanOrEqual(ms(card.issuedAt))
      expect(ms(txn.createdAt), `${txn.id} before card ${card.lastFour} expires`).toBeLessThan(ms(card.expiresAt))
    }
  })

  it('a policy decision is evaluated when its transaction happens', () => {
    for (const txn of approved) {
      const pol = policyDecisions.find((p) => p.id === txn.policyDecisionId)!
      expect(pol.evaluatedAt, txn.id).toBe(txn.createdAt)
    }
  })

  it('card-issued events match the card record', () => {
    for (const event of activities.filter((a) => a.type === 'card_issued')) {
      const card = cards.find((c) => event.description.includes(`•••• ${c.lastFour}`))!
      expect(event.timestamp, `card ${card.lastFour}`).toBe(card.issuedAt)
    }
  })

  it('the ORT budget alert follows the purchase that triggered it', () => {
    const alert = activities.find((a) => a.type === 'budget_alert' && a.jobId === 'job_ortega')!
    const purchase = approved.find((t) => t.jobId === 'job_ortega')!
    expect(ms(alert.timestamp)).toBeGreaterThan(ms(purchase.createdAt))
  })

  it("each worker's SMS request precedes their approved purchase", () => {
    for (const [smsId, txnId] of [
      ['act-2', 'txn-1'],
      ['act-7', 'txn-3'],
    ]) {
      const sms = activities.find((a) => a.id === smsId)!
      const txn = transactions.find((t) => t.id === txnId)!
      expect(ms(sms.timestamp), `${smsId} before ${txnId}`).toBeLessThan(ms(txn.createdAt))
    }
  })
})

describe('budget totals are preserved', () => {
  it('keeps every job total unchanged', () => {
    expect([job('HEN-1042').spentCents, job('HEN-1042').materialBudgetCents]).toEqual([161_000, 240_000])
    expect([job('ORT-0988').spentCents, job('ORT-0988').materialBudgetCents]).toEqual([138_000, 140_000])
    expect([job('CHN-1051').spentCents, job('CHN-1051').materialBudgetCents]).toEqual([42_000, 180_000])
    expect(initialSnapshot.metrics.totalMaterialSpendCents).toBe(161_000 + 138_000 + 42_000)
  })
})
