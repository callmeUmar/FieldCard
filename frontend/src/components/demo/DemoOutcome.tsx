import { RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrencyPrecise } from '../../lib/format'
import type { SimulatePurchaseResult } from '../../types'
import { Button } from '../ui/Button'
import { buttonClass } from '../ui/buttonStyles'
import { DrawnMark } from './DrawnMark'

export function DemoOutcome({
  result,
  onReset,
}: {
  result: SimulatePurchaseResult
  onReset: () => void
}) {
  const approved =
    result.transaction.status === 'approved' ||
    result.transaction.status === 'simulated'
  const { transaction, policyDecision } = result

  return (
    <div
      className="animate-fade-in-up overflow-hidden rounded-2xl bg-white text-center shadow-sm ring-1 ring-slate-200/80"
      role="status"
    >
      <div className={`h-1 ${approved ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden />
      <div className="p-6 sm:p-10">
        <DrawnMark
          kind={approved ? 'check' : 'cross'}
          className={`mx-auto h-16 w-16 ${approved ? 'text-emerald-600' : 'text-rose-600'}`}
        />
        <p
          className={`mt-5 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] ${
            approved ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          Sandbox authorization · {approved ? 'Approved' : 'Declined'}
        </p>
        <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          {approved ? 'Purchase approved' : 'Purchase declined'}
        </h3>
        <p className="mt-3 text-xl font-semibold tabular-nums text-slate-900">
          {formatCurrencyPrecise(transaction.amountCents)}
          <span className="font-medium text-slate-500"> at {transaction.merchant}</span>
        </p>
        <p className="mt-1 font-mono text-xs text-slate-500">MCC {transaction.mcc}</p>
        <p
          className={`mx-auto mt-4 max-w-lg text-sm font-medium ${
            approved ? 'text-emerald-800' : 'text-rose-800'
          }`}
        >
          {policyDecision.summary}
        </p>
        {transaction.declineReason && (
          <p className="mx-auto mt-2 max-w-lg rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-600/10">
            {transaction.declineReason}
          </p>
        )}
        <p className="mt-4 text-xs text-slate-500">
          Simulation recorded — activity feed and job budget updated where applicable. No real charge.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to={`/policy/${policyDecision.id}`} className={buttonClass('secondary')}>
            View policy detail
          </Link>
          <Link to="/" className={buttonClass('secondary')}>
            Back to overview
          </Link>
          <Button variant="primary" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Reset demo
          </Button>
        </div>
      </div>
    </div>
  )
}
