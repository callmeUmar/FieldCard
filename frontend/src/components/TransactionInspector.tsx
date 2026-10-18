import { ArrowRight, Briefcase, Check, CreditCard, ExternalLink, Store, UserRound, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useDashboard } from '../context/DashboardContext'
import { formatCurrencyPrecise, formatDateTime, jobRemainingCents } from '../lib/format'
import { BudgetMeter } from './BudgetProgress'
import { StatusPill } from './ui/StatusPill'
import { txnTone } from './ui/statusMeta'

const usd = formatCurrencyPrecise

/**
 * Read-only contextual inspector for one purchase: who, where, which job, the
 * policy decision and what it did to the budget. Opening it changes nothing.
 */
export function TransactionInspector({ txnId, onClose }: { txnId: string | null; onClose: () => void }) {
  const { data } = useDashboard()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!txnId) return
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [txnId, onClose])

  const txn = txnId ? data?.transactions.find((t) => t.id === txnId) : undefined
  if (!data || !txn) return null

  const job = data.jobs.find((j) => j.id === txn.jobId)
  const worker = data.workers.find((w) => w.id === txn.workerId)
  const decision = data.policyDecisions.find((p) => p.id === txn.policyDecisionId)
  const tone = txnTone(txn.status)

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button type="button" className="fc-scrim absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" aria-label="Close details" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
        className="fc-inspector absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:inset-y-3 sm:left-auto sm:right-3 sm:max-h-none sm:w-[440px] sm:rounded-3xl"
      >
        {/* Header: graphite, like the card itself */}
        <div className="relative bg-[var(--fc-graphite)] px-6 pb-6 pt-5 text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_90%_0%,rgba(99,102,241,0.22),transparent_70%)]" aria-hidden />
          <div className="relative flex items-center justify-between">
            <p className="fc-kicker text-white/45">Transaction</p>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="fc-num relative mt-3 text-[2.5rem] font-semibold leading-none tracking-[-0.04em]">{usd(txn.amountCents)}</p>
          <h2 id="inspector-title" className="relative mt-2 text-sm text-white/70">
            {txn.merchant} · {formatDateTime(txn.createdAt)}
          </h2>
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <StatusPill txn={txn} />
            <span className="fc-kicker rounded-full border border-white/15 px-2.5 py-1 text-[9.5px] text-white/60">
              Sandbox · no real charge
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {/* Who → where → which job */}
          <section aria-label="Purchase context">
            <p className="fc-kicker text-slate-400">Purchase</p>
            <ol className="mt-3 space-y-0">
              <ChainItem icon={UserRound} label="Worker" value={worker?.name ?? 'Field worker'} sub={worker ? `${worker.role} · ${usd(worker.spendingLimitCents)} per-purchase limit` : undefined} />
              <ChainItem icon={Store} label="Merchant" value={txn.merchant} sub={`MCC ${txn.mcc}`} />
              <ChainItem icon={CreditCard} label="Card" value={`•••• ${txn.cardLastFour}`} sub="Sandbox virtual card" />
              <ChainItem icon={Briefcase} label="Job" value={job ? `${job.code} · ${job.customerName}` : 'Unknown job'} sub={job?.address} last />
            </ol>
          </section>

          {/* Policy decision */}
          {decision && (
            <section aria-label="Policy decision">
              <div className="flex items-center justify-between">
                <p className="fc-kicker text-slate-400">Authorization</p>
                <p className="fc-num text-xs text-slate-500">
                  {decision.rules.filter((r) => r.passed).length} of {decision.rules.length} checks passed
                </p>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-900">{decision.summary}</p>
              <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-100">
                {decision.rules.map((rule) => (
                  <li key={rule.ruleId} className="flex gap-3 px-3.5 py-2.5">
                    <span
                      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full ${
                        rule.passed ? 'bg-emerald-50 text-emerald-600' : rule.ruleId === 'r-approval' ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                      }`}
                      aria-label={rule.passed ? 'Passed' : 'Not passed'}
                    >
                      {rule.passed ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-slate-800">{rule.title}</span>
                      {rule.detail && <span className="block text-xs text-slate-500">{rule.detail}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                to={`/policy/${decision.id}`}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-500"
              >
                Full decision breakdown <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </section>
          )}

          {/* Budget impact */}
          {job && (
            <section aria-label="Budget impact">
              <p className="fc-kicker text-slate-400">Budget impact · {job.code}</p>
              <p className="mt-2 text-sm text-slate-600">
                {tone === 'approved' && <>Counted in job spend. The materials budget reflects this purchase.</>}
                {tone === 'declined' && <>No budget impact — job spend stays at <strong className="fc-num font-semibold text-slate-900">{usd(job.spentCents)}</strong>.</>}
                {tone === 'review' && (
                  <>
                    Not posted yet. If approved, spend goes{' '}
                    <span className="fc-num font-semibold text-slate-900">{usd(job.spentCents)}</span>
                    <ArrowRight className="mx-1 inline h-3.5 w-3.5 text-slate-400" aria-label="to" />
                    <span className="fc-num font-semibold text-slate-900">{usd(job.spentCents + txn.amountCents)}</span>, leaving{' '}
                    <span className="fc-num font-semibold text-slate-900">{usd(jobRemainingCents(job) - txn.amountCents)}</span>.
                  </>
                )}
              </p>
              <div className="mt-4 rounded-2xl border border-slate-100 p-4">
                <BudgetMeter job={job} projectedCents={tone === 'review' ? txn.amountCents : 0} />
              </div>
              {tone === 'review' && (
                <Link to="/approvals" className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-700 hover:text-amber-600">
                  Review in Approvals <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  )
}

function ChainItem({
  icon: Icon,
  label,
  value,
  sub,
  last = false,
}: {
  icon: typeof Store
  label: string
  value: string
  sub?: string
  last?: boolean
}) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span className="absolute left-[15px] top-8 h-[calc(100%-28px)] w-px bg-slate-200" aria-hidden />}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="fc-kicker block text-[9.5px] text-slate-400">{label}</span>
        <span className="block truncate text-sm font-medium text-slate-900">{value}</span>
        {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
      </span>
    </li>
  )
}
