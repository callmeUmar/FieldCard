import { Link } from 'react-router-dom'
import { formatCurrencyPrecise, formatRelativeTime } from '../lib/format'
import type { Job, Transaction, Worker } from '../types'
import { Badge } from './ui/Badge'

function statusVariant(status: Transaction['status']) {
  switch (status) {
    case 'approved':
      return 'success'
    case 'declined':
      return 'danger'
    case 'pending':
      return 'warning'
    case 'simulated':
      return 'simulated'
    default:
      return 'default'
  }
}

function statusLabel(txn: Transaction) {
  if (txn.isSimulated && txn.status === 'simulated') return 'Simulated approved'
  if (txn.isSimulated) return `Simulated ${txn.status}`
  return txn.status.charAt(0).toUpperCase() + txn.status.slice(1)
}

export function TransactionRow({
  txn,
  job,
  worker,
}: {
  txn: Transaction
  job?: Job
  worker?: Worker
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-slate-900">{txn.merchant}</p>
          <Badge variant={statusVariant(txn.status)}>{statusLabel(txn)}</Badge>
          {txn.isSimulated && txn.status !== 'simulated' && (
            <Badge variant="simulated">Demo</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {job?.customerName ?? 'Unknown job'} · {txn.category} ·{' '}
          {worker?.name ?? 'Field worker'} · •••• {txn.cardLastFour}
        </p>
        {txn.declineReason && (
          <p className="mt-1 text-xs text-rose-600">{txn.declineReason}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <div className="text-right">
          <p className="font-semibold tabular-nums text-slate-900">
            {formatCurrencyPrecise(txn.amountCents)}
          </p>
          <p className="text-xs text-slate-400">{formatRelativeTime(txn.createdAt)}</p>
        </div>
        {txn.policyDecisionId && (
          <Link
            to={`/policy/${txn.policyDecisionId}`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Policy
          </Link>
        )}
      </div>
    </div>
  )
}
