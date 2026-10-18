import { describe, expect, it } from 'vitest'
import { initialSnapshot } from '../../data/mockData'
import { activityKind, budgetRisk, byNewest, ruleState, ruleSummary, txnLabel, txnTone } from './statusMeta'

const { activities, transactions, jobs } = initialSnapshot

describe('status presentation helpers', () => {
  it('maps transaction statuses to the financial tones', () => {
    expect(txnTone('approved')).toBe('approved')
    expect(txnTone('simulated')).toBe('approved')
    expect(txnTone('pending')).toBe('review')
    expect(txnTone('declined')).toBe('declined')
    expect(txnLabel({ status: 'pending' })).toBe('Needs review')
  })

  it('classifies seed activity without inventing events', () => {
    const kinds = Object.fromEntries(activities.map((a) => [a.id, activityKind(a, transactions)]))
    expect(kinds['act-1']).toBe('approved')
    expect(kinds['act-2']).toBe('request')
    expect(kinds['act-3']).toBe('card')
    expect(kinds['act-4']).toBe('review')
    expect(kinds['act-5']).toBe('declined')
    expect(kinds['act-6']).toBe('alert')
  })

  it('classifies owner decisions recorded by the adapter', () => {
    const base = { id: 'x', type: 'purchase' as const, description: '', timestamp: '' }
    expect(activityKind({ ...base, title: 'Owner approved purchase' }, transactions)).toBe('owner')
    expect(activityKind({ ...base, title: 'Owner declined purchase' }, transactions)).toBe('owner')
  })

  it('sorts newest first without mutating the source', () => {
    const sorted = byNewest(activities)
    expect(sorted).not.toBe(activities)
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1].timestamp >= sorted[i].timestamp).toBe(true)
  })

  it('keeps the existing budget colour thresholds', () => {
    const hen = jobs.find((j) => j.code === 'HEN-1042')!
    const ort = jobs.find((j) => j.code === 'ORT-0988')!
    expect(budgetRisk(hen)).toMatchObject({ used: 67, label: 'On track' })
    expect(budgetRisk(ort)).toMatchObject({ used: 99, label: 'At limit' })
    expect(budgetRisk({ ...hen, spentCents: 196_000 }).label).toBe('Watch')
  })
})

describe('policy rule language', () => {
  it('treats the approval threshold as owner review, not failure', () => {
    const pol5 = initialSnapshot.policyDecisions.find((p) => p.id === 'pol-5')!
    expect(pol5.rules.map(ruleState)).toEqual(['approval', 'passed'])
    expect(ruleSummary(pol5.rules)).toBe('1 passed · 1 requires owner approval')
    expect(ruleSummary([{ ruleId: 'r-mcc', passed: false }, { ruleId: 'r-budget', passed: true }])).toBe('1 passed · 1 failed')
  })
})
