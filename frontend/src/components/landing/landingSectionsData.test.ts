import { describe, expect, it } from 'vitest'
import { formatCurrencyPrecise } from '../../lib/format'
import { CONTROLS, HOW_IT_WORKS, VISIBILITY } from './landingSectionsData'

const control = (id: string) => CONTROLS.find((c) => c.id === id)!

describe('landing sections data', () => {
  it('keeps the canonical Henderson numbers exact', () => {
    expect(formatCurrencyPrecise(VISIBILITY.before.spentCents)).toBe('$1,610.00')
    expect(formatCurrencyPrecise(VISIBILITY.purchase.amountCents)).toBe('$186.50')
    expect(formatCurrencyPrecise(VISIBILITY.after.spentCents)).toBe('$1,796.50')
    expect(formatCurrencyPrecise(VISIBILITY.after.remainingCents)).toBe('$603.50')
    expect(formatCurrencyPrecise(VISIBILITY.budgetCents)).toBe('$2,400.00')
    expect(VISIBILITY.purchase.status).toBe('approved')
    expect(VISIBILITY.purchase.checksPassed).toBe(VISIBILITY.purchase.checksTotal)
  })

  it('walks the request through the real agent policy checks', () => {
    expect(HOW_IT_WORKS.rules.map((r) => r.id)).toEqual([
      'r-job-active',
      'r-worker-limit',
      'r-budget',
      'r-mcc',
      'r-approval',
    ])
    expect(HOW_IT_WORKS.rules.every((r) => r.passed)).toBe(true)
    expect(HOW_IT_WORKS.result.remaining).toBe('$603.50')
    expect(HOW_IT_WORKS.card.hours).toBe(4)
  })

  it('shows one approved and one stopped example per control', () => {
    expect(CONTROLS.map((c) => c.id)).toEqual(['budget', 'worker', 'mcc', 'threshold', 'single-use', 'expiry'])
    for (const c of CONTROLS) {
      expect(c.pass.evaluation.status, c.id).toBe('approved')
      expect(c.fail.evaluation.status, c.id).not.toBe('approved')
    }
  })

  it('stops each counter-example for the reason its control describes', () => {
    expect(control('budget').fail.evaluation.declineReason).toBe('Would exceed job materials budget')
    expect(control('worker').fail.evaluation.declineReason).toBe('Exceeds worker spending limit')
    expect(control('mcc').fail.evaluation.declineReason).toBe('MCC 5200 is not in allowed_mccs [5074]')
    expect(control('threshold').fail.evaluation.status).toBe('pending')
    expect(control('single-use').fail.evaluation.declineReason).toBe('Single-use sandbox card already consumed')
    expect(control('expiry').fail.evaluation.declineReason).toBe('Sandbox card has expired')
  })

  it('places linear examples on the correct side of their limit', () => {
    for (const id of ['budget', 'worker', 'threshold', 'expiry']) {
      const { pass, fail } = control(id)
      expect(pass.scale!.marker, id).toBeLessThanOrEqual(pass.scale!.limit)
      expect(fail.scale!.marker, id).toBeGreaterThan(fail.scale!.limit)
    }
  })
})
