import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrencyPrecise, formatRelativeTime } from '../lib/format'
import type { Job, Transaction, Worker } from '../types'
import { StatusPill } from './ui/StatusPill'
import { TONE_CLASSES, txnTone } from './ui/statusMeta'

/**
 * One purchase. With `onSelect` the whole row opens the transaction inspector;
 * without it, the row links to the policy breakdown as before.
 */
export function TransactionRow({
  txn,
  job,
  worker,
  onSelect,
  selected = false,
}: {
  txn: Transaction
  job?: Job
  worker?: Worker
  onSelect?: (txn: Transaction) => void
  selected?: boolean
}) {
  const tone = txnTone(txn.status)
  const body = (
    <>
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold ring-1 ring-inset ${TONE_CLASSES[tone]}`}
        aria-hidden
      >
        {txn.merchant.charAt(0)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold leading-snug text-slate-900">{txn.merchant}</span>
          {txn.isSimulated && (
            <span className="fc-kicker rounded bg-violet-50 px-1.5 py-0.5 text-[9.5px] text-violet-700 ring-1 ring-inset ring-violet-600/15">
              Sandbox
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">
          {job?.code ?? 'Unknown job'} · {worker?.name ?? 'Field worker'} · MCC {txn.mcc} · •••• {txn.cardLastFour}
        </span>
        {txn.declineReason && <span className="mt-1 block text-xs leading-snug text-rose-600">{txn.declineReason}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="fc-num text-sm font-semibold text-slate-900">{formatCurrencyPrecise(txn.amountCents)}</span>
        <StatusPill txn={txn} size="sm" />
      </span>
    </>
  )

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={() => onSelect(txn)}
        aria-current={selected}
        aria-label={`${txn.merchant}, ${formatCurrencyPrecise(txn.amountCents)}, ${txn.status}. Open details`}
        className="fc-row group flex w-full items-center gap-3 border-b border-slate-100 px-5 py-3.5 text-left last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
      >
        {body}
        <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" aria-hidden />
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 last:border-0">
      {body}
      <span className="hidden w-16 shrink-0 text-right sm:block">
        <span className="block text-[11px] text-slate-400">{formatRelativeTime(txn.createdAt)}</span>
        {txn.policyDecisionId && (
          <Link to={`/policy/${txn.policyDecisionId}`} className="text-xs font-medium text-indigo-600 hover:text-indigo-500">
            Policy
          </Link>
        )}
      </span>
    </div>
  )
}
