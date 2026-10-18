import { describe, expect, it } from 'vitest'
import { AUTO_APPROVE_THRESHOLD_CENTS } from '../lib/policyEngine'
import { initialSnapshot } from './mockData'

const { transactions, workers, jobs, cards, policyDecisions, activities } = initialSnapshot
const henderson = jobs.find((j) => j.code === 'HEN-1042')!

describe('Henderson seed history is consistent with recorded policy', () => {
  const approved = transactions.filter((t) => t.jobId === henderson.id && t.status === 'approved' && !t.isSimulated)

  it('auto-approved purchases fit the worker limit, the card cap and the approval threshold', () => {
    expect(approved.length).toBeGreaterThan(0)
    for (const txn of approved) {
      const worker = workers.find((w) => w.id === txn.workerId)!
      const card = cards.find((c) => c.jobId === txn.jobId && c.lastFour === txn.cardLastFour)!
      const ownerApproved = activities.some((a) => a.transactionId === txn.id && a.title.startsWith('Owner approved'))
      expect(txn.amountCents, `${txn.id} vs ${worker.name}'s limit`).toBeLessThanOrEqual(worker.spendingLimitCents)
      expect(txn.amountCents, `${txn.id} vs card cap`).toBeLessThanOrEqual(card.spendLimitCents)
      if (!ownerApproved) expect(txn.amountCents, `${txn.id} vs auto-approve threshold`).toBeLessThanOrEqual(AUTO_APPROVE_THRESHOLD_CENTS)
    }
  })

  it('the approved Ferguson record agrees with its activity entry and budget detail', () => {
    const txn = transactions.find((t) => t.id === 'txn-1')!
    expect(txn).toMatchObject({ workerId: 'w_mike', merchant: 'Ferguson Plumbing Supply', amountCents: 22_890 })
    expect(activities.find((a) => a.transactionId === 'txn-1')!.description).toContain('$228.90')
    // Henderson spend only grows, so "remaining after" can never be below today's remaining budget
    const remainingNow = henderson.materialBudgetCents - henderson.spentCents - henderson.committedCents
    const budgetRule = policyDecisions.find((p) => p.id === txn.policyDecisionId)!.rules.find((r) => r.ruleId === 'r-budget')!
    expect(budgetRule.detail).toBe('$790.00 remaining after purchase')
    expect(remainingNow).toBe(79_000)
  })

  it('leaves the canonical Henderson figures untouched', () => {
    expect(henderson.spentCents).toBe(161_000)
    expect(henderson.materialBudgetCents).toBe(240_000)
  })
})
