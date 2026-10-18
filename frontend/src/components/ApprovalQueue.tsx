import { ArrowRight, Check, CheckCircle2, Clock3, Loader2, ShieldCheck, X, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useDashboard } from '../context/DashboardContext'
import { formatCurrencyPrecise, formatRelativeTime, jobRemainingCents } from '../lib/format'
import type { Job, Transaction, Worker } from '../types'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'

const usd = formatCurrencyPrecise

type Decision = { action: 'approve' | 'decline'; merchant: string; amountCents: number; jobCode?: string }

/**
 * Owner decision center. Each request states who asked, why it needs review
 * (the policy rule that routed it here) and exactly what each choice does.
 */
export function ApprovalQueue({
  transactions,
  jobs,
  workers,
}: {
  transactions: Transaction[]
  jobs: Job[]
  workers: Worker[]
}) {
  const { approve, decline, data } = useDashboard()
  const [busy, setBusy] = useState<{ id: string; action: 'approve' | 'decline' } | null>(null)
  const [lastDecision, setLastDecision] = useState<Decision | null>(null)

  const pending = transactions.filter((t) => t.status === 'pending')

  const handle = async (txn: Transaction, action: 'approve' | 'decline') => {
    setBusy({ id: txn.id, action })
    try {
      if (action === 'approve') await approve(txn.id)
      else await decline(txn.id)
      setLastDecision({
        action,
        merchant: txn.merchant,
        amountCents: txn.amountCents,
        jobCode: jobs.find((j) => j.id === txn.jobId)?.code,
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby="queue-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 id="queue-heading" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-slate-900">
          Pending decisions
          <span className="fc-num flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">
            {pending.length}
          </span>
        </h3>
        <p className="hidden text-xs text-slate-500 sm:block">Sandbox decisions · no real charges</p>
      </div>

      <div aria-live="polite" role="status">
        {lastDecision && (
          <p
            key={`${lastDecision.merchant}-${lastDecision.amountCents}-${lastDecision.action}`}
            className={`fc-enter flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
              lastDecision.action === 'approve'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {lastDecision.action === 'approve' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
            )}
            <span>
              <span className="font-semibold">
                {lastDecision.action === 'approve' ? 'Approved' : 'Declined'} <span className="fc-num">{usd(lastDecision.amountCents)}</span>
              </span>{' '}
              at {lastDecision.merchant}
              {lastDecision.action === 'approve'
                ? ` — posted to ${lastDecision.jobCode ?? 'the job'} and logged in activity.`
                : ' — blocked; job budget unchanged.'}{' '}
              Sandbox decision, no real charge.
            </span>
          </p>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-emerald-500" aria-hidden />
          <p className="mt-3 font-medium text-slate-900">You&apos;re all caught up</p>
          <p className="mt-1 text-sm text-slate-500">Purchases over the auto-approve threshold will wait here for you.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {pending.map((txn) => {
            const job = jobs.find((j) => j.id === txn.jobId)
            const worker = workers.find((w) => w.id === txn.workerId)
            const decision = data?.policyDecisions.find((p) => p.id === txn.policyDecisionId)
            const reason = decision?.rules.find((r) => r.ruleId === 'r-approval' && !r.passed)?.detail ?? decision?.summary
            const othersPassed = decision?.rules.filter((r) => r.ruleId !== 'r-approval').every((r) => r.passed) ?? false
            const isBusy = busy?.id === txn.id
            const remaining = job ? jobRemainingCents(job) : 0
            return (
              <li
                key={txn.id}
                className="fc-enter overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(217,119,6,0.35)]"
              >
                <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                      {worker?.name.charAt(0) ?? '?'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-slate-500">
                        <span className="font-semibold text-slate-900">{worker?.name ?? 'A field worker'}</span> requested ·{' '}
                        {formatRelativeTime(txn.createdAt)}
                      </p>
                      <p className="mt-1 text-[15px] font-semibold text-slate-900">
                        {txn.merchant} <span className="font-normal text-slate-400">· MCC {txn.mcc}</span>
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {job && <Badge variant="code">{job.code}</Badge>}
                        <span className="text-xs text-slate-500">{job?.customerName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <p className="fc-num text-[1.75rem] font-semibold leading-none tracking-[-0.03em] text-slate-900">{usd(txn.amountCents)}</p>
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden />
                      Awaiting owner
                    </p>
                  </div>
                </div>

                {reason && (
                  <p className="mx-5 rounded-xl bg-amber-50/70 px-3.5 py-2.5 text-[13px] text-amber-900">
                    <span className="font-semibold">Why you&apos;re seeing this:</span> {reason}.{othersPassed && ' Every other policy check passed.'}
                  </p>
                )}

                <div className="grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-2 mt-5">
                  <div className="bg-white px-5 py-3.5">
                    <p className="fc-kicker text-[9.5px] text-emerald-700">If you approve</p>
                    <p className="mt-1 text-[13px] text-slate-600">
                      Posts to {job?.code ?? 'the job'} · remaining{' '}
                      <span className="fc-num font-semibold text-slate-900">{usd(remaining)}</span>
                      <ArrowRight className="mx-1 inline h-3 w-3 text-slate-400" aria-label="becomes" />
                      <span className="fc-num font-semibold text-slate-900">{usd(remaining - txn.amountCents)}</span>
                    </p>
                  </div>
                  <div className="bg-white px-5 py-3.5">
                    <p className="fc-kicker text-[9.5px] text-rose-700">If you decline</p>
                    <p className="mt-1 text-[13px] text-slate-600">Purchase is blocked · budget stays unchanged</p>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:flex-row sm:justify-end">
                  <Button variant="secondary" disabled={isBusy} onClick={() => handle(txn, 'decline')} className="min-h-10">
                    {isBusy && busy?.action === 'decline' ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    {isBusy && busy?.action === 'decline' ? 'Declining…' : 'Decline'}
                  </Button>
                  <Button variant="success" disabled={isBusy} onClick={() => handle(txn, 'approve')} className="min-h-10">
                    {isBusy && busy?.action === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {isBusy && busy?.action === 'approve' ? 'Approving…' : `Approve ${usd(txn.amountCents)}`}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
