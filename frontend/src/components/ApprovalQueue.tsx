import { Check, CheckCircle2, Clock, X, XCircle } from 'lucide-react'
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
  const [lastDecision, setLastDecision] = useState<{
    action: 'approve' | 'decline'
    merchant: string
    amountCents: number
  } | null>(null)

  const pending = transactions.filter((t) => t.status === 'pending')

  const handle = async (txn: Transaction, action: 'approve' | 'decline') => {
    setBusyId(txn.id)
    try {
      if (action === 'approve') await approve(txn.id)
      else await decline(txn.id)
      setLastDecision({ action, merchant: txn.merchant, amountCents: txn.amountCents })
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
      <div aria-live="polite">
        {lastDecision && (
          <p
            className={`flex items-start gap-2 border-b px-5 py-3 text-sm ${
              lastDecision.action === 'approve'
                ? 'border-emerald-100 bg-emerald-50/70 text-emerald-800'
                : 'border-rose-100 bg-rose-50/70 text-rose-800'
            }`}
          >
            {lastDecision.action === 'approve' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            )}
            <span>
              <span className="font-semibold">
                {lastDecision.action === 'approve' ? 'Approved' : 'Declined'}{' '}
                {formatCurrencyPrecise(lastDecision.amountCents)}
              </span>{' '}
              at {lastDecision.merchant} — sandbox decision recorded in activity. No real charge.
            </span>
          </p>
        )}
      </div>
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
              <li key={txn.id} className="border-l-2 border-amber-400 px-5 py-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{txn.merchant}</span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-600/15">
                        <Clock className="h-3 w-3" aria-hidden />
                        Owner review
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      <span className="text-base font-semibold text-slate-900">
                        {formatCurrencyPrecise(txn.amountCents)}
                      </span>{' '}
                      · {job?.customerName} · {worker?.name}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      disabled={busyId === txn.id}
                      onClick={() => handle(txn, 'approve')}
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busyId === txn.id}
                      onClick={() => handle(txn, 'decline')}
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
