import { TransactionRow } from '../components/TransactionRow'
import { ApprovalQueue } from '../components/ApprovalQueue'
import { useDashboard } from '../context/DashboardContext'
import { Card, CardHeader } from '../components/ui/Card'

export function ApprovalsPage() {
  const { data, loading } = useDashboard()
  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }

  const decided = data.transactions.filter(
    (t) => t.status === 'approved' || t.status === 'declined' || t.status === 'simulated',
  )

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Approvals
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Review field purchases against job policy and budgets.
        </p>
      </div>

      <ApprovalQueue
        transactions={data.transactions}
        jobs={data.jobs}
        workers={data.workers}
      />

      <Card>
        <CardHeader
          title="Decision history"
          description="Approved and declined purchases"
        />
        {decided.map((txn) => (
          <TransactionRow
            key={txn.id}
            txn={txn}
            job={data.jobs.find((j) => j.id === txn.jobId)}
            worker={data.workers.find((w) => w.id === txn.workerId)}
          />
        ))}
      </Card>
    </div>
  )
}
