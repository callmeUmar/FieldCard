import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { formatCurrencyPrecise } from '../lib/format'
import type { Job, Transaction, Worker } from '../types'
import { useDashboard } from '../context/DashboardContext'
import { Button } from './ui/Button'
import { Card, CardHeader } from './ui/Card'

export function ApprovalQueue({
  transactions,
  jobs,
  workers,
}: {
  transactions: Transaction[]
  jobs: Job[]
  workers: Worker[]
}) {
  const { approve, decline } = useDashboard()
  const [busyId, setBusyId] = useState<string | null>(null)

  const pending = transactions.filter((t) => t.status === 'pending')

  const handle = async (id: string, action: 'approve' | 'decline') => {
    setBusyId(id)
    try {
      if (action === 'approve') await approve(id)
      else await decline(id)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Pending approvals"
        description={`${pending.length} purchase${pending.length === 1 ? '' : 's'} need owner action`}
      />
      {pending.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No pending approvals — you&apos;re all caught up.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {pending.map((txn) => {
            const job = jobs.find((j) => j.id === txn.jobId)
            const worker = workers.find((w) => w.id === txn.workerId)
            return (
              <li key={txn.id} className="px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{txn.merchant}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatCurrencyPrecise(txn.amountCents)} · {job?.customerName} ·{' '}
                      {worker?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      disabled={busyId === txn.id}
                      onClick={() => handle(txn.id, 'approve')}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busyId === txn.id}
                      onClick={() => handle(txn.id, 'decline')}
                    >
                      <X className="h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
