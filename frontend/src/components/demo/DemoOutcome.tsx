import { CheckCircle2, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrencyPrecise } from '../../lib/format'
import type { SimulatePurchaseResult } from '../../types'
import { Button } from '../ui/Button'

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
      className={`rounded-2xl border-2 p-6 text-center transition-all duration-500 sm:p-10 ${
        approved
          ? 'border-emerald-300 bg-gradient-to-b from-emerald-50 to-white'
          : 'border-rose-300 bg-gradient-to-b from-rose-50 to-white'
      }`}
    >
      <div
        className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
          approved ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}
      >
        {approved ? (
          <CheckCircle2 className="h-9 w-9" strokeWidth={2} />
        ) : (
          <XCircle className="h-9 w-9" strokeWidth={2} />
        )}
      </div>
      <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
        {approved ? 'Purchase approved' : 'Purchase declined'}
      </h3>
      <p className="mt-2 text-lg font-semibold text-slate-800">
        {formatCurrencyPrecise(transaction.amountCents)} at {transaction.merchant}
      </p>
      <p
        className={`mx-auto mt-3 max-w-lg text-sm font-medium ${
          approved ? 'text-emerald-800' : 'text-rose-800'
        }`}
      >
        {policyDecision.summary}
      </p>
      {transaction.declineReason && (
        <p className="mt-2 text-sm text-rose-700">{transaction.declineReason}</p>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Simulation recorded — activity feed and job budget updated where applicable.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to={`/policy/${policyDecision.id}`}>
          <Button variant="secondary">View policy detail</Button>
        </Link>
        <Link to="/">
          <Button variant="secondary">Back to overview</Button>
        </Link>
        <Button variant="primary" onClick={onReset}>Reset demo</Button>
      </div>
    </div>
  )
}
