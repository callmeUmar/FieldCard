import { CheckCircle2, Loader2, Sparkles, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatCurrencyPrecise } from '../lib/format'
import type { Job, SimulatePurchaseResult } from '../types'
import { useDashboard } from '../context/DashboardContext'
import { Button } from './ui/Button'
import { Card, CardHeader } from './ui/Card'

const PRESETS = [
  {
    label: 'PEX (approve)',
    merchant: 'Ferguson Plumbing Supply',
    category: 'Plumbing Supply',
    amountCents: 18_650,
    jobId: 'job-henderson',
  },
  {
    label: 'Home Depot (decline)',
    merchant: 'Home Depot Pro',
    category: 'General Retail',
    amountCents: 8_900,
    jobId: 'job-henderson',
  },
  {
    label: 'Over $250 (pending)',
    merchant: 'Ferguson Plumbing Supply',
    category: 'Plumbing Supply',
    amountCents: 27_500,
    jobId: 'job-henderson',
  },
]

const CATEGORIES = [
  'Plumbing Supply',
  'HVAC Supply',
  'Electrical Supply',
  'Hardware',
  'General Retail',
  'Online Marketplace',
]

export function TransactionSimulator({ jobs }: { jobs: Job[] }) {
  const { simulate, simulating } = useDashboard()
  const activeJobs = useMemo(
    () => jobs.filter((j) => j.status === 'active'),
    [jobs],
  )

  const [jobId, setJobId] = useState(activeJobs[0]?.id ?? '')
  const [merchant, setMerchant] = useState('Ferguson Plumbing Supply')
  const [category, setCategory] = useState('Plumbing Supply')
  const [amount, setAmount] = useState('125.00')
  const [lastResult, setLastResult] = useState<SimulatePurchaseResult | null>(null)

  const amountCents = Math.round(parseFloat(amount || '0') * 100)

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setJobId(preset.jobId)
    setMerchant(preset.merchant)
    setCategory(preset.category)
    setAmount((preset.amountCents / 100).toFixed(2))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!jobId || amountCents <= 0) return
    const result = await simulate({ jobId, merchant, category, amountCents })
    if (result) setLastResult(result)
  }

  const approved =
    lastResult &&
    (lastResult.transaction.status === 'approved' ||
      lastResult.transaction.status === 'simulated')

  return (
    <div className="space-y-4">
      {lastResult && (
        <div
          className={`rounded-xl border-2 p-4 transition-all duration-500 sm:p-5 ${
            approved
              ? 'border-emerald-300 bg-emerald-50'
              : lastResult.transaction.status === 'pending'
                ? 'border-amber-300 bg-amber-50'
                : 'border-rose-300 bg-rose-50'
          }`}
        >
          <div className="flex items-start gap-3">
            {approved ? (
              <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            ) : (
              <XCircle className="h-6 w-6 shrink-0 text-rose-600" />
            )}
            <div>
              <p className="font-semibold text-slate-900">
                {lastResult.transaction.status === 'pending'
                  ? 'Pending owner review'
                  : approved
                    ? 'Simulated — approved'
                    : 'Simulated — declined'}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {formatCurrencyPrecise(lastResult.transaction.amountCents)} at{' '}
                {lastResult.transaction.merchant}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {lastResult.policyDecision.summary}
              </p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader
          title="Transaction simulator"
          description="Local policy engine with simulated results — swap in the real API via the adapter when ready."
          action={
            <Sparkles className="h-5 w-5 text-violet-500" strokeWidth={1.75} />
          }
        />
        <form onSubmit={onSubmit} className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Job</span>
              <select
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {activeJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} — {j.customerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Amount (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <span className="mt-1 block text-xs text-slate-400">
                Preview: {formatCurrencyPrecise(amountCents || 0)}
              </span>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Merchant</span>
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>

          <Button type="submit" disabled={simulating || amountCents <= 0} className="w-full sm:w-auto">
            {simulating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running policy check…
              </>
            ) : (
              'Simulate purchase'
            )}
          </Button>
        </form>
      </Card>
    </div>
  )
}
