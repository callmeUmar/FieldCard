import { describe, expect, it } from 'vitest'
import { activityKind } from '../components/ui/statusMeta'
import { dashboardFixture } from './liveFixture'
import { burnFromSnapshot, resolveMerchantName, toSnapshot } from './liveMapping'

describe('toSnapshot', () => {
  const snap = toSnapshot(dashboardFixture())

  it('marks the snapshot live and converts dollars to cents', () => {
    expect(snap.source).toBe('live')
    const job = snap.jobs[0]
    expect(job).toMatchObject({ id: 'job_henderson', code: 'HEN-01', customerName: 'Henderson Repipe', materialBudgetCents: 240_000, spentCents: 167_000, assignedWorkerId: 'w_mike' })
    expect(job.notes).toContain('copper pipe 3/4')
    expect(snap.workers[0]).toMatchObject({ phone: '•••-•••-1111', spendingLimitCents: 30_000 })
  })

  it('maps card states, treating a past expiry as expired', () => {
    expect(snap.cards.map((c) => [c.lastFour, c.status])).toEqual([['0377', 'used'], ['1111', 'expired']])
  })

  it('turns requests waiting for the owner into pending purchases with the policy reasons', () => {
    const pending = snap.transactions.filter((t) => t.status === 'pending')
    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({ merchant: 'Home Depot', amountCents: 60_000 })
    const decision = snap.policyDecisions.find((p) => p.id === pending[0].policyDecisionId)!
    const failed = decision.rules.filter((r) => !r.passed).map((r) => r.ruleId)
    expect(failed).toEqual(['r-mcc', 'r-approval'])
    expect(snap.metrics.pendingApprovals).toBe(1)
  })

  it('explains a wrong-store decline with a failed MCC rule', () => {
    const declined = snap.transactions.find((t) => t.id === 'txn_no')!
    const decision = snap.policyDecisions.find((p) => p.id === declined.policyDecisionId)!
    expect(decision.approved).toBe(false)
    expect(decision.rules.filter((r) => !r.passed).map((r) => r.ruleId)).toEqual(['r-mcc'])
    expect(declined.cardLastFour).toBe('0377')
  })

  it('classifies backend activity kinds for the feed filters', () => {
    expect(snap.activities.map((a) => activityKind(a, snap.transactions))).toEqual(['review', 'approved', 'declined'])
  })

  it('maps receipts with flagged items', () => {
    expect(snap.receipts?.[0]).toMatchObject({ store: 'Ferguson', totalCents: 4218, items: ['Copper elbow 3/4', 'Snacks'], flags: ['Snacks: not a planned material'] })
  })
})

describe('resolveMerchantName', () => {
  const live = [{ name: 'Ferguson' }, { name: 'Home Depot' }]
  it('matches exact names, then catalog names that start with a live store name', () => {
    expect(resolveMerchantName('ferguson', live)).toBe('Ferguson')
    expect(resolveMerchantName('Ferguson Plumbing Supply', live)).toBe('Ferguson')
    expect(resolveMerchantName('Home Depot Pro', live)).toBe('Home Depot')
  })
  it('passes unknown stores through so the backend can decline them', () => {
    expect(resolveMerchantName('Pacific Plumbing Supply', live)).toBe('Pacific Plumbing Supply')
  })
})

describe('burnFromSnapshot', () => {
  it('starts from spend before tracked purchases and ends at current spend', () => {
    const snap = toSnapshot(dashboardFixture())
    const burn = burnFromSnapshot(snap, 'job_henderson')!
    expect(burn.baselineCents).toBe(161_000)
    expect(burn.points.map((p) => p.spentCents)).toEqual([161_000, 167_000, 167_000])
    expect(burnFromSnapshot(snap, 'job_nope')).toBeNull()
  })
})
