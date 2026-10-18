import { describe, expect, it } from 'vitest'
import { computeCardExpiresAt } from './cardLifecycle'
import {
  AUTO_APPROVE_THRESHOLD_CENTS,
  evaluateAgentRequest,
  evaluatePurchase,
} from './policyEngine'
import { JOB_MATERIAL_MCCS, MCC_HOME_IMPROVEMENT, MCC_PLUMBING_SUPPLY } from '../data/merchants'
import type { Job, VirtualCard, Worker } from '../types'

const job: Job = {
  id: 'job_henderson',
  code: 'HEN-1042',
  customerName: 'Henderson kitchen remodel',
  address: 'x',
  trade: 'plumbing',
  status: 'active',
  assignedWorkerId: 'w_mike',
  materialBudgetCents: 240_000,
  spentCents: 161_000,
  committedCents: 0,
  startedAt: new Date().toISOString(),
}

const worker: Worker = {
  id: 'w_mike',
  name: 'Mike',
  role: 'Lead',
  phone: 'x',
  spendingLimitCents: 30_000,
}

const issuedAt = new Date('2026-06-01T10:00:00.000Z')
const card: VirtualCard = {
  id: 'card_live',
  jobId: job.id,
  lastFour: '4821',
  spendLimitCents: 18_650,
  allowedMccs: [MCC_PLUMBING_SUPPLY],
  issuedAt: issuedAt.toISOString(),
  expiresAt: computeCardExpiresAt(issuedAt),
  status: 'active',
  singleUse: true,
}

describe('evaluateAgentRequest', () => {
  it('separates worker limit from requested amount', () => {
    const rules = evaluateAgentRequest(job, worker, 18_650, MCC_PLUMBING_SUPPLY)
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
      mcc: MCC_PLUMBING_SUPPLY,
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
      mcc: MCC_PLUMBING_SUPPLY,
      amountCents: AUTO_APPROVE_THRESHOLD_CENTS + 1,
    })
    expect(result.status).toBe('pending')
  })

  it('uses issued card cap not worker max', () => {
    const result = evaluatePurchase({
      job,
      worker,
      merchant: 'Ferguson',
      mcc: MCC_PLUMBING_SUPPLY,
      amountCents: 18_650,
      card,
    })
    const capRule = result.rules.find((r) => r.ruleId === 'r-card-limit')
    expect(capRule?.passed).toBe(true)
    expect(capRule?.detail).toContain('$186.50')
  })

  it('declines Home Depot via MCC 5200 not on allowed_mccs', () => {
    const result = evaluatePurchase({
      job,
      worker,
      merchant: 'Home Depot Pro',
      mcc: MCC_HOME_IMPROVEMENT,
      amountCents: 8_900,
      card,
    })
    expect(result.approved).toBe(false)
    expect(result.declineReason).toContain('5200')
    expect(result.declineReason).toContain('allowed_mccs')
    expect(result.declineReason).not.toMatch(/home depot/i)
  })

  it('declines when single-use card already used', () => {
    const usedCard = { ...card, status: 'used' as const }
    const result = evaluatePurchase({
      job,
      worker,
      merchant: 'Ferguson',
      mcc: MCC_PLUMBING_SUPPLY,
      amountCents: 18_650,
      card: usedCard,
    })
    expect(result.approved).toBe(false)
  })
})

describe('JOB_MATERIAL_MCCS', () => {
  it('excludes Home Improvement MCC 5200', () => {
    expect(JOB_MATERIAL_MCCS).not.toContain(MCC_HOME_IMPROVEMENT)
  })
})
