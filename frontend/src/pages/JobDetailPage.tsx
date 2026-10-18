import { AlertTriangle, ArrowLeft, Briefcase, ChevronRight, CreditCard, Gauge, MapPin, Receipt, ShoppingBag, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { dashboardApi } from '../api/dataSource'
import type { BurnSeries } from '../api/liveMapping'
import { BudgetMeter } from '../components/BudgetProgress'
import { SpendChart } from '../components/SpendChart'
import { VirtualCardDisplay } from '../components/demo/VirtualCardDisplay'
import { TransactionInspector } from '../components/TransactionInspector'
import { TransactionRow } from '../components/TransactionRow'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import { PageLoading } from '../components/ui/PageLoading'
import { StatusPill } from '../components/ui/StatusPill'
import { budgetRisk, byNewest } from '../components/ui/statusMeta'
import { useDashboard } from '../context/DashboardContext'
import { formatCurrencyPrecise, jobRemainingCents } from '../lib/format'
import type { VirtualCard } from '../types'

const usd = formatCurrencyPrecise

/** The card a job is currently spending on: the active one, else the most recently issued */
function currentCard(cards: VirtualCard[]) {
  return cards.find((c) => c.status === 'active') ?? [...cards].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))[0]
}

export function JobDetailPage() {
  const { jobId } = useParams()
  const { data, loading } = useDashboard()
  const [selected, setSelected] = useState<string | null>(null)
  const close = useCallback(() => setSelected(null), [])
  const [burn, setBurn] = useState<BurnSeries | null>(null)

  // Refetch the spend series only when this job's spend or purchases change, not on every activity poll.
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  }, [data])
  const jobSnapshot = data?.jobs.find((j) => j.id === jobId)
  const burnKey = `${data?.source}:${jobSnapshot?.spentCents}:${data?.transactions.filter((t) => t.jobId === jobId).length}`
  useEffect(() => {
    const snap = dataRef.current
    if (!snap || !jobId) return
    let cancelled = false
    dashboardApi
      .getBurn(jobId, snap)
      .then((b) => !cancelled && setBurn(b))
      .catch(() => !cancelled && setBurn(null))
    return () => {
      cancelled = true
    }
  }, [jobId, burnKey])

  if (loading || !data) return <PageLoading label="Loading job…" />

  const job = data.jobs.find((j) => j.id === jobId)
  if (!job) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <p className="font-medium text-slate-900">Job not found</p>
        <p className="mt-1 text-sm text-slate-500">It may have been removed when the demo was reset.</p>
        <Link to="/jobs" className="mt-4 inline-block text-sm font-semibold text-indigo-600">
          Back to jobs
        </Link>
      </div>
    )
  }

  const worker = data.workers.find((w) => w.id === job.assignedWorkerId)
  const card = currentCard(data.cards.filter((c) => c.jobId === job.id))
  const txns = byNewest(data.transactions.filter((t) => t.jobId === job.id))
  const receipts = (data.receipts ?? []).filter((r) => r.jobId === job.id)
  const latest = txns[0]
  const risk = budgetRisk(job)

  const chain = [
    { icon: Briefcase, label: 'Job', value: job.code, sub: `${usd(job.materialBudgetCents)} materials budget` },
    { icon: UserRound, label: 'Worker', value: worker?.name ?? 'Unassigned', sub: worker ? `${usd(worker.spendingLimitCents)} per purchase` : '—' },
    {
      icon: CreditCard,
      label: 'Virtual card',
      value: card ? `•••• ${card.lastFour}` : 'No card',
      sub: card ? `${card.status} · MCC ${card.allowedMccs.join(', ')}` : 'Issued per request',
    },
    {
      icon: ShoppingBag,
      label: 'Latest purchase',
      value: latest ? usd(latest.amountCents) : 'None yet',
      sub: latest ? latest.merchant : 'Purchases appear here',
      txn: latest,
    },
    { icon: Gauge, label: 'Budget impact', value: usd(jobRemainingCents(job)), sub: `remaining · ${risk.used}% used` },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to="/jobs" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        All jobs
      </Link>

      <div className="fc-enter">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="code">{job.code}</Badge>
          <Badge variant={job.status === 'active' ? 'success' : 'default'}>{job.status.replace('_', ' ')}</Badge>
        </div>
        <h2 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-slate-900 sm:text-[2rem]">{job.customerName}</h2>
        {job.address && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {job.address}
          </p>
        )}
      </div>

      {/* The relationship, left to right */}
      <ol className="fc-enter fc-enter-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="How spending on this job is controlled">
        {chain.map((step, i) => (
          <li key={step.label} className="relative">
            <div className="flex h-full items-start gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                <step.icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="fc-kicker text-[9.5px] text-slate-400">
                  {String(i + 1).padStart(2, '0')} · {step.label}
                </p>
                <p className="fc-num mt-1 truncate text-[15px] font-semibold text-slate-900">{step.value}</p>
                <p className="line-clamp-2 text-xs text-slate-500">{step.sub}</p>
                {step.txn && (
                  <div className="mt-2">
                    <StatusPill txn={step.txn} size="sm" />
                  </div>
                )}
              </div>
            </div>
            {i < chain.length - 1 && (
              <ChevronRight
                className="absolute -right-[13px] top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--fc-canvas)] text-slate-400 lg:block"
                aria-hidden
              />
            )}
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="fc-enter fc-enter-2 p-5 sm:p-6">
            <p className="text-[15px] font-semibold tracking-tight text-slate-900">Materials budget</p>
            <div className="mt-4">
              <BudgetMeter job={job} />
            </div>
            {job.notes && <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">{job.notes}</p>}
          </Card>

          {burn && burn.points.length > 1 && (
            <Card className="fc-enter fc-enter-2 p-5 sm:p-6">
              <p className="text-[15px] font-semibold tracking-tight text-slate-900">Materials spend over time</p>
              <p className="mt-0.5 text-xs text-slate-500">Cumulative spend on {job.code} against its {usd(burn.budgetCents)} budget</p>
              <div className="mt-4">
                <SpendChart series={burn} />
              </div>
            </Card>
          )}

          <Card className="fc-enter fc-enter-3 overflow-hidden">
            <CardHeader title="Purchases" description={`${txns.length} on this job · select one for its decision and budget impact`} />
            {txns.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">No purchases yet. They appear here as soon as a card is used.</p>
            ) : (
              txns.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  txn={txn}
                  job={job}
                  worker={data.workers.find((w) => w.id === txn.workerId)}
                  onSelect={(t) => setSelected(t.id)}
                  selected={selected === txn.id}
                />
              ))
            )}
          </Card>

          <Card className="fc-enter fc-enter-3 overflow-hidden">
            <CardHeader title="Receipts" description="Receipt photos texted by the crew, checked against the job's planned materials" />
            {receipts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No receipts yet. They appear here when a worker texts a photo.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {receipts.map((r) => (
                  <li key={r.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Receipt className="h-4 w-4 text-slate-400" aria-hidden />
                        {r.store}
                      </p>
                      {r.totalCents != null && <p className="fc-num text-sm font-semibold text-slate-900">{usd(r.totalCents)}</p>}
                    </div>
                    {r.items.length > 0 && <p className="mt-1 text-xs text-slate-500">{r.items.join(' · ')}</p>}
                    {r.flags.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {r.flags.map((f) => (
                          <li key={f} className="flex items-start gap-1.5 text-xs text-amber-800">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span>
                              <span className="font-semibold">Not in plan:</span> {f}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-emerald-700">All items match the plan</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="fc-enter fc-enter-2 space-y-3">
          {card ? (
            <>
              <VirtualCardDisplay
                lastFour={card.lastFour}
                spendLimitCents={card.spendLimitCents}
                allowedMccs={card.allowedMccs}
                issuedAt={card.issuedAt}
                expiresAt={card.expiresAt}
                singleUse={card.singleUse === true}
                capBasis={card.singleUse ? 'Approved request amount (not worker max)' : 'Per-transaction cap on this job card'}
              />
              <p className="px-1 text-xs text-slate-500">
                Card status: <span className="font-medium capitalize text-slate-700">{card.status}</span>
              </p>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              No sandbox card issued for this job yet.
            </div>
          )}
        </div>
      </div>

      <TransactionInspector txnId={selected} onClose={close} />
    </div>
  )
}
