import { Activity, ArrowRight, Check, Clock3, Loader2, MessageSquareText, ShieldCheck, Stamp, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { resolveMerchantName } from '../api/liveMapping'
import { MERCHANTS } from '../data/merchants'
import { formatCurrencyPrecise } from '../lib/format'
import type { Job, SimulatePurchaseResult } from '../types'
import { useDashboard } from '../context/DashboardContext'
import { Button } from './ui/Button'
import { Card, CardHeader } from './ui/Card'
import { RULE_STATE_LABEL, ruleState, TONE_CLASSES, txnLabel, txnTone } from './ui/statusMeta'

const ferguson = MERCHANTS.find((m) => m._id === 'merchant_ferguson')!
const homeDepot = MERCHANTS.find((m) => m._id === 'merchant_home_depot')!
const usd = formatCurrencyPrecise

const PRESETS = [
  {
    label: 'PEX (approve)',
    merchant: ferguson.name,
    mcc: ferguson.mcc,
    amountCents: 18_650,
    jobId: 'job_henderson',
  },
  {
    label: 'Home Depot (decline)',
    merchant: homeDepot.name,
    mcc: homeDepot.mcc,
    amountCents: 8_900,
    jobId: 'job_henderson',
  },
  {
    label: 'Over $250 (pending)',
    merchant: ferguson.name,
    mcc: ferguson.mcc,
    amountCents: 27_500,
    jobId: 'job_henderson',
  },
]

type Phase = 'idle' | 'request' | 'policy' | 'result' | 'activity'
const ORDER: Phase[] = ['idle', 'request', 'policy', 'result', 'activity']
const STAGES = [
  { phase: 'request' as const, label: 'Request', icon: MessageSquareText },
  { phase: 'policy' as const, label: 'Policy evaluation', icon: ShieldCheck },
  { phase: 'result' as const, label: 'Authorization', icon: Stamp },
  { phase: 'activity' as const, label: 'Activity update', icon: Activity },
]
const RULE_STAGGER_MS = 130

/**
 * Authorization terminal. Each submit calls the adapter's simulate exactly
 * once; the four stages then stage that single result for the viewer.
 */
export function TransactionSimulator({ jobs }: { jobs: Job[] }) {
  const { simulate, simulating, data, source } = useDashboard()
  // Live: the backend's own stores (names must match for its lookup). Offline: the bundled catalog.
  const catalog = useMemo(
    () =>
      source === 'live' && data?.merchants.length
        ? data.merchants.map((m) => ({ _id: m.id, name: m.name, mcc: m.mcc }))
        : MERCHANTS,
    [source, data],
  )
  const activeJobs = useMemo(() => jobs.filter((j) => j.status === 'active'), [jobs])

  const [jobId, setJobId] = useState(activeJobs[0]?.id ?? '')
  const [chosenMerchant, setMerchant] = useState(ferguson.name)
  const [chosenMcc, setMcc] = useState(ferguson.mcc)
  // Show the chosen store as it exists in the current catalog (presets use catalog names like "Ferguson Plumbing Supply").
  const catalogMatch = catalog.find((m) => m.name === resolveMerchantName(chosenMerchant, catalog))
  const merchant = catalogMatch?.name ?? chosenMerchant
  const mcc = catalogMatch?.mcc ?? chosenMcc
  const [amount, setAmount] = useState('125.00')
  const [phase, setPhase] = useState<Phase>('idle')
  const [run, setRun] = useState<{ request: { job?: Job; merchant: string; mcc: string; amountCents: number; spentBefore: number }; result?: SimulatePurchaseResult } | null>(null)
  const timers = useRef<number[]>([])

  const amountCents = Math.round(parseFloat(amount || '0') * 100)
  const at = (p: Phase) => ORDER.indexOf(phase) >= ORDER.indexOf(p)

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setJobId(preset.jobId)
    setMerchant(preset.merchant)
    setMcc(preset.mcc)
    setAmount((preset.amountCents / 100).toFixed(2))
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!jobId || amountCents <= 0 || simulating) return
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    const job = jobs.find((j) => j.id === jobId)
    setRun({ request: { job, merchant, mcc, amountCents, spentBefore: job?.spentCents ?? 0 } })
    setPhase('request')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const policyAt = window.setTimeout(() => setPhase((p) => (p === 'request' ? 'policy' : p)), reduce ? 0 : 320)
    timers.current.push(policyAt)

    let result: SimulatePurchaseResult | undefined
    try {
      result = await simulate({ jobId, merchant, mcc, amountCents })
    } catch {
      result = undefined
    }
    if (!result) {
      timers.current.forEach((t) => window.clearTimeout(t))
      setRun(null)
      setPhase('idle')
      return
    }
    setRun((r) => (r ? { ...r, result } : r))
    setPhase('policy')
    const rulesDone = reduce ? 0 : result.policyDecision.rules.length * RULE_STAGGER_MS + 250
    timers.current.push(window.setTimeout(() => setPhase('result'), rulesDone))
    timers.current.push(window.setTimeout(() => setPhase('activity'), reduce ? 0 : rulesDone + 650))
  }

  const result = run?.result
  const tone = result ? txnTone(result.transaction.status) : null
  // After the refresh, `jobs` holds the live post-purchase figures
  const jobNow = run?.request.job ? jobs.find((j) => j.id === run.request.job!.id) : undefined

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <Card className="overflow-hidden">
        <CardHeader title="Compose a purchase" description="Runs the local policy engine · results are labeled sandbox simulations" />
        <form onSubmit={onSubmit} className="space-y-5 px-5 py-5">
          <div>
            <p className="fc-kicker text-[9.5px] text-slate-400">Scenarios</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="fc-press rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Job</span>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={fieldClass}>
                {activeJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.code} — {j.customerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">Merchant</span>
              <select
                value={merchant}
                onChange={(e) => {
                  const m = catalog.find((x) => x.name === e.target.value)
                  setMerchant(e.target.value)
                  if (m) setMcc(m.mcc)
                }}
                className={fieldClass}
              >
                {catalog.map((m) => (
                  <option key={m._id} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700">MCC</span>
              <input value={mcc} readOnly className={`${fieldClass} bg-slate-50 font-mono`} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Amount (USD)</span>
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${fieldClass} fc-num text-base`} />
              <span className="mt-1 block text-xs text-slate-400">Preview: {usd(amountCents || 0)}</span>
            </label>
          </div>

          <Button type="submit" disabled={simulating || amountCents <= 0} className="min-h-11 w-full">
            {simulating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running policy check…
              </>
            ) : (
              <>
                Authorize in sandbox <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Terminal */}
      <section className="overflow-hidden rounded-3xl bg-[var(--fc-graphite)] text-white shadow-[0_30px_60px_-30px_rgba(15,23,42,0.6)]" aria-label="Authorization terminal">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <p className="fc-kicker text-white/50">Authorization terminal</p>
          <p className="fc-kicker rounded-full border border-amber-300/40 px-2 py-0.5 text-[9.5px] text-amber-200">Sandbox</p>
        </div>
        <ol className="grid grid-cols-4 border-b border-white/[0.08]" aria-label="Stages">
          {STAGES.map((s) => {
            const done = at(s.phase)
            const current = phase === s.phase
            return (
              <li key={s.phase} className={`flex flex-col items-center gap-1.5 px-1 py-3 text-center ${current ? 'text-white' : done ? 'text-indigo-200' : 'text-white/30'}`} aria-current={current ? 'step' : undefined}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-300 ${current ? 'bg-indigo-500' : done ? 'bg-indigo-500/25' : 'bg-white/[0.06]'}`}>
                  <s.icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </span>
                <span className="fc-kicker text-[8.5px] leading-tight sm:text-[9.5px]">{s.label}</span>
              </li>
            )
          })}
        </ol>

        <div className="min-h-[420px] space-y-3 p-5" aria-live="polite">
          {!run && (
            <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
              <ShieldCheck className="h-7 w-7 text-white/25" aria-hidden />
              <p className="mt-3 text-sm font-medium text-white/80">Waiting for a purchase</p>
              <p className="mt-1 max-w-xs text-xs text-white/45">Pick a scenario or compose one, then authorize. Each run is recorded once and labeled as a simulation.</p>
            </div>
          )}

          {run && (
            <>
              <Stage state={at('request') ? (phase === 'request' ? 'active' : 'done') : 'idle'} label="Request">
                <p className="fc-num text-2xl font-semibold tracking-tight">{usd(run.request.amountCents)}</p>
                <p className="mt-0.5 text-sm text-white/65">
                  {run.request.merchant} · MCC {run.request.mcc} · {run.request.job?.code}
                </p>
              </Stage>

              <Stage state={at('policy') ? (phase === 'policy' ? 'active' : 'done') : 'idle'} label="Policy evaluation">
                {!result ? (
                  <p className="flex items-center gap-2 text-sm text-white/65">
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> Checking job, worker limit, budget, MCC and card…
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {result.policyDecision.rules.map((r, i) => (
                      <li key={r.ruleId} className="fc-rule-in flex items-start gap-2 text-[13px]" style={{ animationDelay: `${i * RULE_STAGGER_MS}ms` }}>
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                            r.passed ? 'bg-emerald-400/15 text-emerald-300' : r.ruleId === 'r-approval' ? 'bg-amber-400/15 text-amber-300' : 'bg-rose-400/15 text-rose-300'
                          }`}
                          aria-label={RULE_STATE_LABEL[ruleState(r)]}
                        >
                          {r.passed ? (
                            <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                          ) : ruleState(r) === 'approval' ? (
                            <Clock3 className="h-2.5 w-2.5" strokeWidth={3} />
                          ) : (
                            <X className="h-2.5 w-2.5" strokeWidth={3.5} />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="text-white/90">{r.title}</span>
                          {r.detail && <span className="text-white/45"> · {r.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Stage>

              <Stage state={at('result') ? (phase === 'result' ? 'active' : 'done') : 'idle'} label="Authorization result">
                {result && at('result') && tone && (
                  <div className="fc-stamp flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${TONE_CLASSES[tone]}`}>
                      {tone === 'approved' ? <Check className="h-5 w-5" strokeWidth={2.5} /> : tone === 'review' ? <Clock3 className="h-5 w-5" /> : <X className="h-5 w-5" strokeWidth={2.5} />}
                    </span>
                    <div>
                      <p className="text-lg font-semibold">{tone === 'review' ? 'Routed to owner review' : `${txnLabel(result.transaction)} in sandbox`}</p>
                      <p className="mt-0.5 text-sm text-white/65">{result.policyDecision.summary}</p>
                    </div>
                  </div>
                )}
              </Stage>

              <Stage state={at('activity') ? 'done' : 'idle'} label="Activity update">
                {result && at('activity') && (
                  <div className="fc-stamp space-y-1.5 text-sm">
                    <p className="text-white/90">{result.activity.title}</p>
                    <p className="text-white/50">{result.activity.description}</p>
                    {jobNow && (
                      <p className="text-white/65">
                        {jobNow.code} spend{' '}
                        {tone === 'approved' ? (
                          <>
                            <span className="fc-num text-white">{usd(run.request.spentBefore)}</span>
                            <ArrowRight className="mx-1 inline h-3.5 w-3.5 text-white/40" aria-label="to" />
                            <span className="fc-num font-semibold text-emerald-300">{usd(jobNow.spentCents)}</span>
                          </>
                        ) : (
                          <>
                            unchanged at <span className="fc-num text-white">{usd(jobNow.spentCents)}</span>
                            {tone === 'review' && ' until the owner decides'}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </Stage>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

const fieldClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20'

function Stage({ state, label, children }: { state: 'idle' | 'active' | 'done'; label: string; children: ReactNode }) {
  return (
    <div
      data-state={state}
      className={`fc-stage rounded-2xl border px-4 py-3.5 ${
        state === 'active' ? 'border-indigo-400/40 bg-indigo-500/[0.08]' : state === 'done' ? 'border-white/[0.08] bg-white/[0.03]' : 'border-white/[0.05] bg-transparent'
      }`}
    >
      <p className="fc-kicker text-[9.5px] text-white/40">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  )
}
