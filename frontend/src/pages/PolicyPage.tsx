import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PolicyExplanation } from '../components/PolicyExplanation'
import { Badge } from '../components/ui/Badge'
import { PageHeader } from '../components/ui/PageHeader'
import { PageLoading } from '../components/ui/PageLoading'
import { StatusPill } from '../components/ui/StatusPill'
import { useDashboard } from '../context/DashboardContext'
import { formatCurrencyPrecise } from '../lib/format'

export function PolicyPage() {
  const { policyId } = useParams()
  const { data, loading } = useDashboard()
  if (loading || !data) return <PageLoading label="Loading policy decision…" />

  const decision = data.policyDecisions.find((p) => p.id === policyId)
  if (!decision) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <p className="font-medium text-slate-900">Policy decision not found</p>
        <p className="mt-1 text-sm text-slate-500">It may have been cleared when the demo was reset.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-indigo-600">
          Back to overview
        </Link>
      </div>
    )
  }

  const job = data.jobs.find((j) => j.id === decision.jobId)
  const txn = data.transactions.find((t) => t.id === decision.transactionId)
  const worker = txn ? data.workers.find((w) => w.id === txn.workerId) : undefined

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={job ? `/jobs/${job.id}` : '/'}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {job ? job.customerName : 'Overview'}
      </Link>

      <PageHeader
        kicker="Policy decision"
        title={txn ? `${formatCurrencyPrecise(txn.amountCents)} at ${txn.merchant}` : 'Decision breakdown'}
        description={
          txn && (
            <span className="flex flex-wrap items-center gap-2">
              {job && <Badge variant="code">{job.code}</Badge>}
              <span>
                {worker?.name ?? 'Field worker'} · MCC {txn.mcc} · •••• {txn.cardLastFour}
              </span>
              <StatusPill txn={txn} size="sm" />
            </span>
          )
        }
      />

      <PolicyExplanation decision={decision} pending={txn?.status === 'pending'} />
    </div>
  )
}
