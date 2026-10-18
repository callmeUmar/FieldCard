import { useCallback, useState } from 'react'
import { TransactionInspector } from '../components/TransactionInspector'
import { TransactionRow } from '../components/TransactionRow'
import { TransactionSimulator } from '../components/TransactionSimulator'
import { Card, CardHeader } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { PageLoading } from '../components/ui/PageLoading'
import { byNewest } from '../components/ui/statusMeta'
import { useDashboard } from '../context/DashboardContext'

export function SimulatorPage() {
  const { data, loading } = useDashboard()
  const [selected, setSelected] = useState<string | null>(null)
  const close = useCallback(() => setSelected(null), [])
  if (loading || !data) return <PageLoading label="Loading simulator…" />

  const simulated = byNewest(data.transactions.filter((t) => t.isSimulated))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        kicker="Simulator"
        title="Authorization terminal"
        description="Send a purchase through the same policy engine the dashboard uses and watch each stage decide. Every run is a labeled sandbox simulation — no real charges."
      />

      <TransactionSimulator jobs={data.jobs} />

      <Card className="overflow-hidden">
        <CardHeader title="Simulated transactions" description="Every run, honestly labeled · select one to inspect" />
        {simulated.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No simulated runs yet — try a scenario above.</p>
        ) : (
          simulated.map((txn) => (
            <TransactionRow
              key={txn.id}
              txn={txn}
              job={data.jobs.find((j) => j.id === txn.jobId)}
              worker={data.workers.find((w) => w.id === txn.workerId)}
              onSelect={(t) => setSelected(t.id)}
              selected={selected === txn.id}
            />
          ))
        )}
      </Card>

      <TransactionInspector txnId={selected} onClose={close} />
    </div>
  )
}
