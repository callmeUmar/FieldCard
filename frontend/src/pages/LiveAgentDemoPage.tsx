import {
  ArrowRight,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Store,
  Wand2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DuplicatePurchaseError, fieldcardApi } from '../api/adapter'
import { DemoOutcome } from '../components/demo/DemoOutcome'
import { PolicyStepList } from '../components/demo/PolicyStepList'
import { StepRail } from '../components/demo/StepRail'
import { VirtualCardDisplay } from '../components/demo/VirtualCardDisplay'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import {
  ALLOWED_PURCHASE,
  BLOCKED_PURCHASE,
  LIVE_AGENT_SMS,
  LIVE_DEMO_CARD_ID,
  PARSED_REQUEST,
} from '../demo/liveAgentScenario'
import { useDashboard } from '../context/DashboardContext'
import {
  agentRequestApproved,
  evaluateAgentRequest,
  formatUsd,
} from '../lib/policyEngine'
import { formatCurrencyPrecise } from '../lib/format'
import type { SimulatePurchaseResult } from '../types'

const STEP_COUNT = 6

export function LiveAgentDemoPage() {
  const { data, refresh, resetDemo } = useDashboard()
  const [step, setStep] = useState(0)
  const [policyRevealed, setPolicyRevealed] = useState(0)
  const [policyRunning, setPolicyRunning] = useState(false)
  const [setupRecorded, setSetupRecorded] = useState(false)
  const [purchaseBusy, setPurchaseBusy] = useState(false)
  const [result, setResult] = useState<SimulatePurchaseResult | null>(null)
  const policyAnimStarted = useRef(false)

  const job = data?.jobs.find((j) => j.id === 'job-henderson')
  const worker = data?.workers.find((w) => w.id === 'w-mike')

  const policyRules = useMemo(() => {
    return evaluateAgentRequest(
      job,
      worker,
      PARSED_REQUEST.amountCents,
      PARSED_REQUEST.category,
    )
  }, [job, worker])

  const policyPassed = agentRequestApproved(policyRules)

  const issuedDemoCard = useMemo(
    () => data?.cards.find((c) => c.id === LIVE_DEMO_CARD_ID),
    [data?.cards],
  )

  const runPolicyReveal = useCallback(() => {
    setPolicyRunning(true)
    setPolicyRevealed(0)
    let i = 0
    const tick = () => {
      i += 1
      setPolicyRevealed(i)
      if (i < policyRules.length) {
        window.setTimeout(tick, 380)
      } else {
        setPolicyRunning(false)
      }
    }
    window.setTimeout(tick, 300)
  }, [policyRules.length])

  useEffect(() => {
    if (step !== 3) {
      policyAnimStarted.current = false
      return
    }
    if (!policyAnimStarted.current && policyRevealed === 0 && !policyRunning) {
      policyAnimStarted.current = true
      runPolicyReveal()
    }
  }, [step, policyRevealed, policyRunning, runPolicyReveal])

  const goNext = async () => {
    if (step === 3 && !setupRecorded && policyRevealed >= policyRules.length) {
      await fieldcardApi.recordLiveAgentSetup()
      setSetupRecorded(true)
      await refresh()
    }
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1))
  }

  const railStep = step === 0 ? 0 : step >= 5 ? 5 : step - 1

  const runPurchase = async (variant: 'allowed' | 'blocked') => {
    if (purchaseBusy) return
    setPurchaseBusy(true)
    try {
      const res = await fieldcardApi.runLiveAgentPurchase(variant)
      setResult(res)
      setStep(5)
      await refresh()
    } catch (err) {
      if (err instanceof DuplicatePurchaseError) {
        window.alert(err.message)
      }
    } finally {
      setPurchaseBusy(false)
    }
  }

  const handleReset = async () => {
    await resetDemo()
    setStep(0)
    setPolicyRevealed(0)
    setPolicyRunning(false)
    setSetupRecorded(false)
    setResult(null)
    policyAnimStarted.current = false
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Live Agent Demo
            </h2>
            <Badge variant="simulated">Simulation</Badge>
          </div>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Walk through SMS → AI parsing → policy → sandbox card → purchase. No live
            SMS, Visa network, or external AI APIs — deterministic mock behavior for
            judging.
          </p>
        </div>
        <Button variant="secondary" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          Reset demo
        </Button>
      </div>

      <Card className="p-4 sm:p-5">
        <StepRail current={railStep} />
      </Card>

      <div
        key={step}
        className="animate-fade-in-up space-y-4"
      >
        {step === 0 && (
          <Card className="p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  90-second judging script
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Mike texts Fieldcard for job <strong>HEN-1042</strong>. The agent
                  structures the request, runs policy checks, issues a sandbox card, then
                  you swipe at an allowed and blocked merchant to show control.
                </p>
                <Button className="mt-6" onClick={goNext}>
                  Start simulation
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <MessageSquare className="h-4 w-4" />
              Inbound SMS (simulated)
            </div>
            <div className="mt-4 max-w-lg rounded-2xl rounded-tl-sm bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white shadow-lg">
              {LIVE_AGENT_SMS}
            </div>
            <p className="mt-3 text-xs text-slate-400">From Mike · {worker?.phone}</p>
            <Button className="mt-6" onClick={goNext}>
              Agent interprets message
              <Wand2 className="h-4 w-4" />
            </Button>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Structured request
            </h3>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ['Job', `${PARSED_REQUEST.jobCode} — ${PARSED_REQUEST.jobLabel}`],
                ['Worker', PARSED_REQUEST.workerName],
                ['Merchant', PARSED_REQUEST.merchant],
                ['Materials', PARSED_REQUEST.materials],
                ['Amount', formatCurrencyPrecise(PARSED_REQUEST.amountCents)],
                [
                  'Worker limit',
                  worker
                    ? formatCurrencyPrecise(worker.spendingLimitCents)
                    : '—',
                ],
                ['Category', PARSED_REQUEST.category],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                >
                  <dt className="text-xs font-medium text-slate-400">{label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>
            <Button className="mt-6" onClick={goNext}>
              Run policy engine
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Policy evaluation</h3>
              {policyRevealed >= policyRules.length && (
                <Badge variant={policyPassed ? 'success' : 'danger'}>
                  {policyPassed ? 'All checks passed' : 'Blocked'}
                </Badge>
              )}
            </div>
            <div className="mt-4">
              <PolicyStepList rules={policyRules} revealedCount={policyRevealed} />
            </div>
            {policyRevealed >= policyRules.length && policyPassed && (
              <Button className="mt-6" onClick={goNext} disabled={policyRunning}>
                Issue sandbox card
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </Card>
        )}

        {step === 4 && !issuedDemoCard && (
          <Card className="p-6 text-sm text-slate-500">
            Issuing sandbox card… go back one step if this persists.
          </Card>
        )}

        {step === 4 && issuedDemoCard && (
          <div className="space-y-4">
            <VirtualCardDisplay
              lastFour={issuedDemoCard.lastFour}
              spendLimitCents={issuedDemoCard.spendLimitCents}
              categories={issuedDemoCard.merchantCategories}
              issuedAt={issuedDemoCard.issuedAt}
              expiresAt={issuedDemoCard.expiresAt}
            />
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Simulate card swipe
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Choose a merchant — outcomes are deterministic for this demo.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={purchaseBusy}
                  onClick={() => runPurchase('allowed')}
                  className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 text-left transition hover:border-emerald-400 hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-emerald-800">
                    <Store className="h-5 w-5" />
                    <span className="font-semibold">{ALLOWED_PURCHASE.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{ALLOWED_PURCHASE.merchant}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatUsd(ALLOWED_PURCHASE.amountCents)}
                  </p>
                </button>
                <button
                  type="button"
                  disabled={purchaseBusy}
                  onClick={() => runPurchase('blocked')}
                  className="rounded-xl border-2 border-rose-200 bg-rose-50/50 p-4 text-left transition hover:border-rose-400 hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-rose-800">
                    <Store className="h-5 w-5" />
                    <span className="font-semibold">{BLOCKED_PURCHASE.label}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{BLOCKED_PURCHASE.merchant}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatUsd(BLOCKED_PURCHASE.amountCents)}
                  </p>
                </button>
              </div>
            </Card>
          </div>
        )}

        {step === 5 && result && (
          <DemoOutcome result={result} onReset={handleReset} />
        )}
      </div>
    </div>
  )
}
