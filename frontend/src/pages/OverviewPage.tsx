import {
  ArrowUpRight,
  Briefcase,
  CreditCard,
  DollarSign,
  Percent,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { ActivityFeed } from '../components/ActivityFeed'
import { BudgetProgress } from '../components/BudgetProgress'
import { MetricCard } from '../components/MetricCard'
import { TransactionRow } from '../components/TransactionRow'
import { ApprovalQueue } from '../components/ApprovalQueue'
import { useDashboard } from '../context/DashboardContext'
import { formatCurrency, formatPercent } from '../lib/format'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'

export function OverviewPage() {
  const { data, loading } = useDashboard()
  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading dashboard…
      </div>
    )
  }

  const { metrics, jobs, transactions, activities, workers } = data
  const activeJobs = jobs.filter((j) => j.status === 'active')
  const recentTx = transactions.slice(0, 5)
  const budgetUsed = Math.round(
    (metrics.totalMaterialSpendCents / metrics.monthlyBudgetCents) * 100,
  )

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="animate-fade-in-up flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Overview
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Material spend, job budgets, and field activity at a glance.
          </p>
        </div>
        <Link
          to="/live-demo"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-slate-900/15 transition hover:bg-slate-800"
        >
          <Sparkles className="h-4 w-4" />
          Live Agent Demo
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <Card className="border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 to-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-900">Judging demo path</p>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Run the 90-second Live Agent flow: Mike&apos;s SMS → policy checks → sandbox
              card → approve &amp; decline swipes. Fully simulated, repeatable, and wired
              into this dashboard.
            </p>
          </div>
          <Link
            to="/live-demo"
            className="shrink-0 text-sm font-semibold text-indigo-700 hover:text-indigo-600"
          >
            Start now →
          </Link>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Material spend (MTD)"
          value={formatCurrency(metrics.totalMaterialSpendCents)}
          subtext={`${budgetUsed}% of ${formatCurrency(metrics.monthlyBudgetCents)} monthly cap`}
          icon={DollarSign}
          trend={{
            value: `↑ ${metrics.spendVsLastMonthPercent}% vs last month`,
            positive: false,
          }}
        />
        <MetricCard
          label="Active jobs"
          value={String(metrics.activeJobs)}
          subtext="HEN-1042, ORT-0988, CHN-1051 in progress"
          icon={Briefcase}
        />
        <MetricCard
          label="Approval rate"
          value={formatPercent(metrics.approvalRatePercent)}
          subtext={`${metrics.pendingApprovals} pending review`}
          icon={Percent}
        />
        <MetricCard
          label="Virtual cards"
          value={String(metrics.cardsActive)}
          subtext="Sandbox cards with category limits"
          icon={CreditCard}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Active jobs"
            description="Material budget utilization by site"
            action={
              <Link to="/jobs" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                View all
              </Link>
            }
          />
          <div className="divide-y divide-slate-100">
            {activeJobs.map((job) => {
              const worker = workers.find((w) => w.id === job.assignedWorkerId)
              return (
                <Link
                  key={job.id}
                  to={`/jobs/${job.id}`}
                  className="block px-5 py-4 transition hover:bg-slate-50/80"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{job.customerName}</p>
                        <Badge variant="brand">{job.code}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {worker?.name} · {job.trade.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <BudgetProgress job={job} />
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Activity feed" description="Recent field & card events" />
          <ActivityFeed items={activities} limit={8} />
          <div className="border-t border-slate-100 px-5 py-3">
            <Link
              to="/activity"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              See full feed
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <ApprovalQueue
          transactions={transactions}
          jobs={jobs}
          workers={workers}
        />
        <Card>
          <CardHeader
            title="Recent transactions"
            description="Approvals, declines, and simulated runs"
          />
          <div>
            {recentTx.map((txn) => (
              <TransactionRow
                key={txn.id}
                txn={txn}
                job={jobs.find((j) => j.id === txn.jobId)}
                worker={workers.find((w) => w.id === txn.workerId)}
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
