import { ArrowUpRight, Briefcase, CreditCard, MapPin } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { BudgetMeter } from '../components/BudgetProgress'
import { TransactionInspector } from '../components/TransactionInspector'
import { TransactionRow } from '../components/TransactionRow'
import { Card, CardHeader } from '../components/ui/Card'
import { byNewest } from '../components/ui/statusMeta'
import { Badge } from '../components/ui/Badge'
import { PageHeader } from '../components/ui/PageHeader'
import { PageLoading } from '../components/ui/PageLoading'
import { useDashboard } from '../context/DashboardContext'
import { formatCurrencyPrecise, jobRemainingCents } from '../lib/format'

const STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'default' }> = {
  active: { label: 'Active', variant: 'success' },
  on_hold: { label: 'On hold', variant: 'warning' },
  completed: { label: 'Completed', variant: 'default' },
}

const RECENT_LIMIT = 6

export function JobsPage() {
  const { data, loading } = useDashboard()
  const [selected, setSelected] = useState<string | null>(null)
  const close = useCallback(() => setSelected(null), [])
  if (loading || !data) return <PageLoading label="Loading jobs…" />

  const { jobs, workers, cards, transactions } = data
  const totalRemaining = jobs.filter((j) => j.status === 'active').reduce((s, j) => s + jobRemainingCents(j), 0)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        kicker="Jobs"
        title="Job budgets & cards"
        description={
          <>
            Every card and purchase is tied to a job code.{' '}
            <span className="fc-num font-medium text-slate-700">{formatCurrencyPrecise(totalRemaining)}</span> remaining across active jobs.
          </>
        }
      />

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <Briefcase className="mx-auto h-6 w-6 text-slate-400" aria-hidden />
          <p className="mt-3 font-medium text-slate-900">No jobs yet</p>
          <p className="mt-1 text-sm text-slate-500">Jobs appear here with their materials budget and sandbox card.</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job, i) => {
            const worker = workers.find((w) => w.id === job.assignedWorkerId)
            const card = cards.find((c) => c.jobId === job.id && c.status === 'active')
            const purchases = transactions.filter((t) => t.jobId === job.id)
            const status = STATUS[job.status] ?? STATUS.completed
            return (
              <li key={job.id} className={`fc-enter fc-enter-${Math.min(i + 1, 3)}`}>
                <Link
                  to={`/jobs/${job.id}`}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_40px_-20px_rgba(15,23,42,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="code">{job.code}</Badge>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <h3 className="mt-3 flex items-center gap-1.5 text-lg font-semibold tracking-tight text-slate-900">
                    {job.customerName}
                    <ArrowUpRight className="h-4 w-4 text-slate-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-500" aria-hidden />
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{job.address}</span>
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2.5 text-slate-700">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                        {worker?.name.charAt(0) ?? '?'}
                      </span>
                      {worker?.name ?? 'Unassigned'} · {job.trade}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      <CreditCard className="h-3.5 w-3.5" aria-hidden />
                      {card ? <span className="fc-num">•••• {card.lastFour}</span> : 'No active card'}
                    </span>
                    <span className="fc-num inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      {purchases.length} purchase{purchases.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="mt-auto border-t border-slate-100 pt-5" style={{ marginTop: '1.25rem' }}>
                    <BudgetMeter job={job} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {transactions.length > 0 && (
        <Card className="fc-enter fc-enter-3 overflow-hidden">
          <CardHeader
            title="Recent purchases"
            description={`Newest across all jobs · showing ${Math.min(RECENT_LIMIT, transactions.length)} of ${transactions.length} · select one to inspect`}
            action={
              <Link to="/activity" className="whitespace-nowrap text-[13px] font-medium text-indigo-600 hover:text-indigo-500">
                Full timeline
              </Link>
            }
          />
          {byNewest(transactions)
            .slice(0, RECENT_LIMIT)
            .map((txn) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                job={jobs.find((j) => j.id === txn.jobId)}
                worker={workers.find((w) => w.id === txn.workerId)}
                onSelect={(t) => setSelected(t.id)}
                selected={selected === txn.id}
              />
            ))}
        </Card>
      )}

      <TransactionInspector txnId={selected} onClose={close} />
    </div>
  )
}
