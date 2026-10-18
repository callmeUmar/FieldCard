import { Activity, ArrowRight, MessageSquareText, ShieldCheck, Stamp } from 'lucide-react'
import { TransactionSimulator } from '../components/TransactionSimulator'
import { TransactionRow } from '../components/TransactionRow'
import { useDashboard } from '../context/DashboardContext'
import { Card, CardHeader } from '../components/ui/Card'

const SIM_FLOW = [
  { label: 'Request', icon: MessageSquareText },
  { label: 'Policy evaluation', icon: ShieldCheck },
  { label: 'Decision', icon: Stamp },
  { label: 'Activity update', icon: Activity },
]

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
        <ol className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-medium text-slate-600" aria-label="How a simulated purchase flows">
          {SIM_FLOW.map((step, i) => (
            <li key={step.label} className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 shadow-sm">
                <step.icon className="h-3.5 w-3.5 text-indigo-500" strokeWidth={2} aria-hidden />
                {step.label}
              </span>
              {i < SIM_FLOW.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />}
            </li>
          ))}
          <li className="ml-1 rounded-full bg-violet-50 px-2.5 py-1 text-violet-700 ring-1 ring-violet-600/15">
            Sandbox only · no real charges
          </li>
        </ol>
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
