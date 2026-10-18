import { useCallback, useState } from 'react'
import { ApprovalQueue } from '../components/ApprovalQueue'
import { TransactionInspector } from '../components/TransactionInspector'
import { TransactionRow } from '../components/TransactionRow'
import { Card, CardHeader } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { PageLoading } from '../components/ui/PageLoading'
import { byNewest } from '../components/ui/statusMeta'
import { useDashboard } from '../context/DashboardContext'
import { formatCurrencyPrecise } from '../lib/format'
import { AUTO_APPROVE_THRESHOLD_CENTS } from '../lib/policyEngine'

export function ApprovalsPage() {
  const { data, loading } = useDashboard()
  const [selected, setSelected] = useState<string | null>(null)
  const close = useCallback(() => setSelected(null), [])
  if (loading || !data) return <PageLoading label="Loading approvals…" />

  const decided = byNewest(data.transactions.filter((t) => t.status !== 'pending'))

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        kicker="Approvals"
        title="Decision center"
        description={`Purchases up to ${formatCurrencyPrecise(AUTO_APPROVE_THRESHOLD_CENTS)} clear automatically when every rule passes. Anything above waits for you here.`}
      />

      <ApprovalQueue transactions={data.transactions} jobs={data.jobs} workers={data.workers} />

      <Card className="overflow-hidden">
        <CardHeader title="Decision history" description="Approved and declined purchases · select one to inspect" />
        {decided.map((txn) => (
          <TransactionRow
            key={txn.id}
            txn={txn}
            job={data.jobs.find((j) => j.id === txn.jobId)}
            worker={data.workers.find((w) => w.id === txn.workerId)}
            onSelect={(t) => setSelected(t.id)}
            selected={selected === txn.id}
          />
        ))}
      </Card>

      <TransactionInspector txnId={selected} onClose={close} />
    </div>
  )
}
