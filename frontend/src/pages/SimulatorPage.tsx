import { TransactionSimulator } from '../components/TransactionSimulator'
import { TransactionRow } from '../components/TransactionRow'
import { useDashboard } from '../context/DashboardContext'
import { Card, CardHeader } from '../components/ui/Card'

export function SimulatorPage() {
  const { data, loading } = useDashboard()
  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading…
      </div>
    )
  }

  const simulated = data.transactions.filter((t) => t.isSimulated)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          Transaction simulator
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Test approve, decline, and pending flows for the live demo. All simulator
          charges are clearly marked.
        </p>
      </div>

      <div>
        <TransactionSimulator jobs={data.jobs} />
      </div>

      <Card>
        <CardHeader
          title="Simulated transactions"
          description="Honest labeling for judges and stakeholders"
        />
        {simulated.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">
            No simulated runs yet — try a preset above.
          </p>
        ) : (
          simulated.map((txn) => (
            <TransactionRow
              key={txn.id}
              txn={txn}
              job={data.jobs.find((j) => j.id === txn.jobId)}
              worker={data.workers.find((w) => w.id === txn.workerId)}
            />
          ))
        )}
      </Card>
    </div>
  )
}
