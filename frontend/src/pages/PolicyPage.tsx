import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PolicyExplanation } from '../components/PolicyExplanation'
import { useDashboard } from '../context/DashboardContext'

export function PolicyPage() {
  const { policyId } = useParams()
  const { data, loading } = useDashboard()

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading policy…
      </div>
    )
  }

  const decision = data.policyDecisions.find((p) => p.id === policyId)
  if (!decision) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-slate-600">Policy decision not found.</p>
        <Link to="/" className="mt-4 inline-block text-indigo-600">
          Back to overview
        </Link>
      </div>
    )
  }

  const job = data.jobs.find((j) => j.id === decision.jobId)
  const txn = data.transactions.find((t) => t.id === decision.transactionId)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={job ? `/jobs/${job.id}` : '/'}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {job ? job.customerName : 'Overview'}
      </Link>

      {txn && (
        <p className="text-sm text-slate-500">
          Transaction: {txn.merchant} · {job?.code}
        </p>
      )}

      <PolicyExplanation decision={decision} />
    </div>
  )
}
