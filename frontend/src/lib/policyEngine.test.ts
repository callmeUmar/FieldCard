import { describe, expect, it } from 'vitest'
import { computeCardExpiresAt } from './cardLifecycle'
import {
  AUTO_APPROVE_THRESHOLD_CENTS,
  evaluateAgentRequest,
  evaluatePurchase,
} from './policyEngine'
import type { Job, VirtualCard, Worker } from '../types'

const job: Job = {
  id: 'job-henderson',
  code: 'HEN-1042',
  customerName: 'Henderson kitchen remodel',
  address: 'x',
  trade: 'plumbing',
  status: 'active',
  assignedWorkerId: 'w-mike',
  materialBudgetCents: 240_000,
  spentCents: 161_000,
  committedCents: 0,
  startedAt: new Date().toISOString(),
}

const worker: Worker = {
  id: 'w-mike',
  name: 'Mike',
  role: 'Lead',
  phone: 'x',
  spendingLimitCents: 30_000,
}

const issuedAt = new Date('2026-06-01T10:00:00.000Z')
const card: VirtualCard = {
  id: 'card-live',
  jobId: job.id,
  lastFour: '4821',
  spendLimitCents: 18_650,
  merchantCategories: ['Plumbing Supply', 'Hardware'],
  issuedAt: issuedAt.toISOString(),
  expiresAt: computeCardExpiresAt(issuedAt),
  status: 'active',
  singleUse: true,
}

describe('evaluateAgentRequest', () => {
  it('separates worker limit from requested amount', () => {
    const rules = evaluateAgentRequest(job, worker, 18_650, 'Plumbing Supply')
    const workerRule = rules.find((r) => r.ruleId === 'r-worker-limit')
    expect(workerRule?.passed).toBe(true)
    expect(workerRule?.detail).toContain('$300.00')
    expect(workerRule?.detail).toContain('$186.50')
  })
})

describe('evaluatePurchase', () => {
  it('declines over worker per-purchase limit', () => {
    const result = evaluatePurchase({
      job,
      worker,
      merchant: 'Ferguson',
      category: 'Plumbing Supply',
      amountCents: 30_001,
      card,
    })
    expect(result.approved).toBe(false)
    expect(result.status).toBe('declined')
  })

  it('routes over approval threshold to owner review', () => {
    const result = evaluatePurchase({
      job,
      worker,
      merchant: 'Ferguson',
      category: 'Plumbing Supply',
      amountCents: AUTO_APPROVE_THRESHOLD_CENTS + 1,
    })
    expect(result.status).toBe('pending')
  })

  it('uses issued card cap not worker max', () => {
    const result = evaluatePurchase({
      job,
      worker,
      merchant: 'Ferguson',
      category: 'Plumbing Supply',
      amountCents: 18_650,
      card,
    })
    const capRule = result.rules.find((r) => r.ruleId === 'r-card-limit')
    expect(capRule?.passed).toBe(true)
    expect(capRule?.detail).toContain('$186.50')
  })

  it('declines blocked merchant without budget impact flag in summary', () => {
    const result = evaluatePurchase({
      job,
      worker,
      merchant: 'Home Depot Pro',
      category: 'General Retail',
      amountCents: 8_900,
      card,
    })
    expect(result.approved).toBe(false)
    expect(result.declineReason).toMatch(/category/i)
  })

  it('declines when single-use card already used', () => {
    const usedCard = { ...card, status: 'used' as const }
    const result = evaluatePurchase({
      job,
      worker,
      merchant: 'Ferguson',
      category: 'Plumbing Supply',
      amountCents: 18_650,
      card: usedCard,
    })
    expect(result.approved).toBe(false)
  })
})
