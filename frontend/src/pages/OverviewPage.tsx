import { ArrowRight, ArrowUpRight, Clock3, Sparkles } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ActivityFeed } from '../components/ActivityFeed'
import { BudgetMeter } from '../components/BudgetProgress'
import { TransactionInspector } from '../components/TransactionInspector'
import { TransactionRow } from '../components/TransactionRow'
import { AnimatedNumber } from '../components/ui/AnimatedNumber'
import { ctaClass } from '../components/ui/buttonStyles'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'
import { PageLoading } from '../components/ui/PageLoading'
import { byNewest } from '../components/ui/statusMeta'
import { useDashboard } from '../context/DashboardContext'
import { formatCurrencyPrecise, jobRemainingCents } from '../lib/format'
import { AUTO_APPROVE_THRESHOLD_CENTS } from '../lib/policyEngine'

const usd = formatCurrencyPrecise
const count = (n: number) => String(n)

export function OverviewPage() {
  const { data, loading } = useDashboard()
  const [selected, setSelected] = useState<string | null>(null)
  const close = useCallback(() => setSelected(null), [])

  if (loading || !data) return <PageLoading label="Loading dashboard…" />

  const { jobs, transactions, activities, workers, cards, company } = data
  const activeJobs = jobs.filter((j) => j.status === 'active')
  const pending = transactions.filter((t) => t.status === 'pending')
  // Every figure here is derived from the live job, transaction and card records
  const spent = jobs.reduce((sum, j) => sum + j.spentCents, 0)
  const budget = jobs.reduce((sum, j) => sum + j.materialBudgetCents, 0)
  const remaining = activeJobs.reduce((sum, j) => sum + jobRemainingCents(j), 0)
  const pendingCents = pending.reduce((sum, t) => sum + t.amountCents, 0)
  const activeCards = cards.filter((c) => c.status === 'active').length

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Command header */}
      <section className="fc-enter relative overflow-hidden rounded-3xl bg-[var(--fc-graphite)] text-white shadow-[0_30px_60px_-30px_rgba(15,23,42,0.6)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_80%_at_85%_0%,rgba(99,102,241,0.22),transparent_70%),radial-gradient(ellipse_40%_60%_at_0%_100%,rgba(99,102,241,0.08),transparent_70%)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 px-6 pb-6 pt-7 sm:px-8 sm:pt-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="fc-kicker flex flex-wrap items-center gap-x-3 gap-y-1 text-white/50">
              <span>{company.name}</span>
              <span className="inline-flex items-center gap-1.5 text-amber-200/90">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
                Sandbox mode
              </span>
            </p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[2.6rem]">
              Every field purchase,
              <br className="hidden sm:block" /> <span className="text-white/55">under your control.</span>
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
              {activeJobs.length} active jobs · {pending.length === 0 ? 'nothing awaiting your review' : `${pending.length} purchase${pending.length === 1 ? '' : 's'} awaiting your review`} ·
              crew requests by SMS, cards issued per purchase.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/live-demo" className={ctaClass.onDark}>
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Run Live Agent Demo
              <ArrowUpRight className="h-4 w-4 opacity-60" />
            </Link>
            {pending.length > 0 ? (
              <Link to="/approvals" className={ctaClass.ghostDark}>
                <Clock3 className="h-4 w-4 text-amber-300" />
                Review {pending.length}
              </Link>
            ) : (
              <Link to="/simulator" className={ctaClass.ghostDark}>
                Open simulator
              </Link>
            )}
          </div>
        </div>

        <dl className="relative grid grid-cols-2 border-t border-white/[0.08] lg:grid-cols-4">
          <Metric label="Material spend" sub={<>of <span className="fc-num">{usd(budget)}</span> budgeted</>}>
            <AnimatedNumber value={spent} format={usd} />
          </Metric>
          <Metric label="Remaining on active jobs" sub={`${activeJobs.length} jobs`} className="border-l">
            <AnimatedNumber value={remaining} format={usd} />
          </Metric>
          <Metric
            label="Awaiting your review"
            sub={pending.length ? <span className="fc-num">{usd(pendingCents)} on hold</span> : 'All caught up'}
            accent={pending.length > 0 ? 'amber' : undefined}
            className="border-t lg:border-l lg:border-t-0"
          >
            <AnimatedNumber value={pending.length} format={count} />
          </Metric>
          <Metric label="Active sandbox cards" sub="MCC-locked, per purchase" className="border-l border-t lg:border-t-0">
            <AnimatedNumber value={activeCards} format={count} />
          </Metric>
        </dl>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          {/* On narrower screens the decision queue leads, since it is the one thing waiting on the owner */}
          <Card className="fc-enter overflow-hidden lg:hidden">
            <CardHeader
              title="Needs your decision"
              description={pending.length ? `Over the ${usd(AUTO_APPROVE_THRESHOLD_CENTS)} auto-approve threshold` : 'Nothing waiting on you'}
              action={
                pending.length > 0 && (
                  <span className="fc-num flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">
                    {pending.length}
                  </span>
                )
              }
            />
            {pending.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">You&apos;re all caught up. New reviews appear here the moment a purchase needs you.</p>
            ) : (
              <>
                {pending.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    job={jobs.find((j) => j.id === txn.jobId)}
                    worker={workers.find((w) => w.id === txn.workerId)}
                    onSelect={(t) => setSelected(t.id)}
                    selected={selected === txn.id}
                  />
                ))}
                <div className="border-t border-slate-100 px-5 py-3">
                  <Link to="/approvals" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-700 hover:text-amber-600">
                    Open approvals <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </>
            )}
          </Card>
          <Card className="fc-enter fc-enter-1 overflow-hidden">
            <CardHeader
              title="Job budgets"
              description="Materials budget per job, updated as purchases clear"
              action={
                <Link to="/jobs" className="whitespace-nowrap text-[13px] font-medium text-indigo-600 hover:text-indigo-500">
                  All jobs
                </Link>
              }
            />
            <ul className="divide-y divide-slate-100">
              {activeJobs.map((job) => {
                const worker = workers.find((w) => w.id === job.assignedWorkerId)
                return (
                  <li key={job.id}>
                    <Link
                      to={`/jobs/${job.id}`}
                      className="fc-row group grid grid-cols-[minmax(0,1fr)] gap-4 px-5 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] sm:items-center sm:gap-8"
                    >
                      <div className="min-w-0">
                        <Badge variant="code">{job.code}</Badge>
                        <p className="mt-2 truncate text-[15px] font-semibold tracking-tight text-slate-900">{job.customerName}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {worker?.name} · {job.trade.toUpperCase()}{job.address && ` · ${job.address.split(',')[0]}`}
                        </p>
                      </div>
                      <BudgetMeter job={job} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card className="fc-enter fc-enter-2 overflow-hidden">
            <CardHeader
              title="Recent transactions"
              description="Select a purchase to see its policy decision and budget impact"
            />
            <div>
              {byNewest(transactions).slice(0, 6).map((txn) => (
                <TransactionRow
                  key={txn.id}
                  txn={txn}
                  job={jobs.find((j) => j.id === txn.jobId)}
                  worker={workers.find((w) => w.id === txn.workerId)}
                  onSelect={(t) => setSelected(t.id)}
                  selected={selected === txn.id}
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="fc-enter fc-enter-1 hidden overflow-hidden lg:block">
            <CardHeader
              title="Needs your decision"
              description={pending.length ? `Over the ${usd(AUTO_APPROVE_THRESHOLD_CENTS)} auto-approve threshold` : 'Nothing waiting on you'}
              action={
                pending.length > 0 && (
                  <span className="fc-num flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">
                    {pending.length}
                  </span>
                )
              }
            />
            {pending.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">You&apos;re all caught up. New reviews appear here the moment a purchase needs you.</p>
            ) : (
              <>
                {pending.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    job={jobs.find((j) => j.id === txn.jobId)}
                    worker={workers.find((w) => w.id === txn.workerId)}
                    onSelect={(t) => setSelected(t.id)}
                    selected={selected === txn.id}
                  />
                ))}
                <div className="border-t border-slate-100 px-5 py-3">
                  <Link to="/approvals" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-700 hover:text-amber-600">
                    Open approvals <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </>
            )}
          </Card>

          <Card className="fc-enter fc-enter-2 overflow-hidden">
            <CardHeader title="Recent activity" description="Requests, checks, cards and outcomes" />
            <ActivityFeed items={activities} limit={6} transactions={transactions} onSelectTransaction={setSelected} dense />
            <div className="border-t border-slate-100 px-5 py-3">
              <Link to="/activity" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-500">
                Full timeline <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <TransactionInspector txnId={selected} onClose={close} />
    </div>
  )
}

function Metric({
  label,
  sub,
  children,
  accent,
  className = '',
}: {
  label: string
  sub: ReactNode
  children: ReactNode
  accent?: 'amber'
  className?: string
}) {
  return (
    <div className={`border-white/[0.08] px-6 py-5 sm:px-8 ${className}`}>
      <dt className="fc-kicker text-[9.5px] text-white/45">{label}</dt>
      <dd className={`mt-2 text-xl font-semibold tracking-tight sm:text-2xl ${accent === 'amber' ? 'text-amber-300' : 'text-white'}`}>{children}</dd>
      <dd className="mt-1 text-xs text-white/45">{sub}</dd>
    </div>
  )
}
