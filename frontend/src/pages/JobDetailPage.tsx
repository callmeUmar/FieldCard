import { ArrowLeft, MapPin, User } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { BudgetProgress } from '../components/BudgetProgress'
import { TransactionRow } from '../components/TransactionRow'
import { useDashboard } from '../context/DashboardContext'
import { formatCurrency, jobRemainingCents } from '../lib/format'
import { Badge } from '../components/ui/Badge'
import { Card, CardHeader } from '../components/ui/Card'

export function JobDetailPage() {
  const { jobId } = useParams()
  const { data, loading } = useDashboard()
  if (loading || !data) return <Loading />

  const job = data.jobs.find((j) => j.id === jobId)
  if (!job) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-slate-600">Job not found.</p>
        <Link to="/jobs" className="mt-4 inline-block text-indigo-600">
          Back to jobs
        </Link>
      </div>
    )
  }

  const worker = data.workers.find((w) => w.id === job.assignedWorkerId)
  const card = data.cards.find((c) => c.jobId === job.id)
  const txns = data.transactions.filter((t) => t.jobId === job.id)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        All jobs
      </Link>

      <div className="animate-fade-in-up">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-semibold text-slate-900">{job.customerName}</h2>
          <Badge variant="brand">{job.code}</Badge>
        </div>
        <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
          <MapPin className="h-4 w-4 shrink-0" />
          {job.address}
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
          <User className="h-4 w-4 shrink-0" />
          {worker?.name} · {worker?.role}
          {worker && (
            <span className="text-slate-400">
              {' '}
              · {formatCurrency(worker.spendingLimitCents)} per-purchase limit
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-400">Budget</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {formatCurrency(job.materialBudgetCents)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-400">Spent</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {formatCurrency(job.spentCents)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase text-slate-400">Remaining</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">
            {formatCurrency(jobRemainingCents(job))}
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">Budget progress</h3>
        <div className="mt-3">
          <BudgetProgress job={job} />
        </div>
        {job.notes && (
          <p className="mt-4 text-sm text-slate-600 border-t border-slate-100 pt-4">
            {job.notes}
          </p>
        )}
      </Card>

      {card && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-slate-900">Virtual card</h3>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <p>
              <span className="text-slate-400">Number</span> · •••• {card.lastFour}
            </p>
            <p>
              <span className="text-slate-400">Limit</span> ·{' '}
              {formatCurrency(card.spendLimitCents)}
            </p>
            <p className="sm:col-span-2">
              <span className="text-slate-400">Categories</span> ·{' '}
              {card.allowedMccs.join(', ')}
            </p>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Transaction history"
          description={`${txns.length} purchases on this job`}
        />
        {txns.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No transactions yet.</p>
        ) : (
          txns.map((txn) => (
            <TransactionRow
              key={txn.id}
              txn={txn}
              job={job}
              worker={data.workers.find((w) => w.id === txn.workerId)}
            />
          ))
        )}
      </Card>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-500">
      Loading job…
    </div>
  )
}
