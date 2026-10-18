import {
  ArrowRight,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DuplicatePurchaseError } from '../api/adapter'
import { dashboardApi } from '../api/dataSource'
import { DemoOutcome } from '../components/demo/DemoOutcome'
import { DemoPurchasePanel } from '../components/demo/DemoPurchasePanel'
import { PolicyStepList } from '../components/demo/PolicyStepList'
import { StepRail } from '../components/demo/StepRail'
import { VirtualCardDisplay } from '../components/demo/VirtualCardDisplay'
import { PhoneConversation } from '../components/phone/PhoneConversation'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { liveDemoStepToPhonePhase } from '../demo/smsConversation'
import { PARSED_REQUEST } from '../demo/liveAgentScenario'
import { useDashboard } from '../context/DashboardContext'
import {
  agentRequestApproved,
  evaluateAgentRequest,
} from '../lib/policyEngine'
import { formatCurrencyPrecise, jobRemainingCents } from '../lib/format'
import type { SimulatePurchaseResult, VirtualCard } from '../types'
import '../styles/landing.css'

const STEP_COUNT = 6

export function LiveAgentDemoPage() {
  const { data, refresh, resetDemo, source } = useDashboard()
  const [step, setStep] = useState(0)
  const [policyRevealed, setPolicyRevealed] = useState(0)
  const [policyRunning, setPolicyRunning] = useState(false)
  const [setupRecorded, setSetupRecorded] = useState(false)
  const [purchaseBusy, setPurchaseBusy] = useState(false)
  const [purchaseFlash, setPurchaseFlash] = useState<'approved' | 'declined' | null>(null)
  const [result, setResult] = useState<SimulatePurchaseResult | null>(null)
  const [demoCard, setDemoCard] = useState<VirtualCard | null>(null)
  const [demoError, setDemoError] = useState<string | null>(null)
  const policyAnimStarted = useRef(false)

  const job = data?.jobs.find((j) => j.id === 'job_henderson')
  const worker = data?.workers.find((w) => w.id === 'w_mike')

  const policyRules = useMemo(() => {
    return evaluateAgentRequest(
      job,
      worker,
      PARSED_REQUEST.amountCents,
      PARSED_REQUEST.mcc,
    )
  }, [job, worker])

  const policyPassed = agentRequestApproved(policyRules)

  // The card issued in step 3; prefer its latest state from the snapshot (e.g. "used" after a purchase)
  const issuedDemoCard = useMemo(
    () => (demoCard ? (data?.cards.find((c) => c.id === demoCard.id) ?? demoCard) : undefined),
    [data?.cards, demoCard],
  )

  const purchaseOutcome = result
    ? result.transaction.status === 'declined'
      ? 'declined'
      : 'approved'
    : null

  const phonePhase = useMemo(() => {
    const phase = liveDemoStepToPhonePhase(step, purchaseOutcome)
    if (
      step === 3 &&
      policyRevealed >= policyRules.length &&
      !policyRunning
    ) {
      return 'agent-checking'
    }
    return phase
  }, [
    step,
    purchaseOutcome,
    policyRevealed,
    policyRules.length,
    policyRunning,
  ])

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
      setDemoError(null)
      try {
        setDemoCard(await dashboardApi.recordLiveAgentSetup())
        setSetupRecorded(true)
      } catch (err) {
        setDemoError(err instanceof Error ? err.message : 'Could not issue the card')
      }
      await refresh()
    }
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1))
  }

  const railStep = step === 0 ? 0 : step >= 5 ? 5 : step - 1

  const runPurchase = async (variant: 'allowed' | 'blocked') => {
    if (purchaseBusy) return
    setPurchaseBusy(true)
    setPurchaseFlash(null)
    setDemoError(null)
    try {
      const res = await dashboardApi.runLiveAgentPurchase(variant)
      setResult(res)
      setPurchaseFlash(res.transaction.status === 'declined' ? 'declined' : 'approved')
      setStep(5)
      await refresh()
    } catch (err) {
      if (err instanceof DuplicatePurchaseError) {
        window.alert(err.message)
      } else {
        setDemoError(err instanceof Error ? err.message : 'Purchase failed')
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
    setDemoCard(null)
    setDemoError(null)
    setPurchaseFlash(null)
    policyAnimStarted.current = false
  }

  const rightPanel = (
    <div className="animate-fade-in-up space-y-4" key={step}>
      {step === 0 && (
        <Card className="p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">90-second judging script</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Mike texts Fieldcard for job <strong>HEN-1042</strong>. Watch the phone as
                the agent structures the request, runs policy, issues a sandbox card, then
                simulate Ferguson (approve) vs Home Depot MCC 5200 (decline).
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
          <h3 className="text-sm font-semibold text-slate-900">Inbound SMS</h3>
          <p className="mt-2 text-sm text-slate-500">
            Simulated message from Mike ({worker?.phone}). Continue when ready to parse.
          </p>
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
              ['Worker', `${PARSED_REQUEST.workerName} · w_mike`],
              ['Merchant', PARSED_REQUEST.merchant],
              ['Materials', PARSED_REQUEST.materials],
              ['Amount', formatCurrencyPrecise(PARSED_REQUEST.amountCents)],
              [
                'Worker limit',
                worker ? formatCurrencyPrecise(worker.spendingLimitCents) : '—',
              ],
              ['MCC', PARSED_REQUEST.mcc],
              ['Budget headroom', job ? `${formatCurrencyPrecise(jobRemainingCents(job))} remaining` : '—'],
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
          {demoError ? (
            <span className="text-rose-700">No card issued: {demoError}</span>
          ) : (
            'Issuing sandbox card… go back one step if this persists.'
          )}
        </Card>
      )}

      {step === 4 && issuedDemoCard && (
        <div className="space-y-4">
          <VirtualCardDisplay
            lastFour={issuedDemoCard.lastFour}
            spendLimitCents={issuedDemoCard.spendLimitCents}
            allowedMccs={issuedDemoCard.allowedMccs}
            issuedAt={issuedDemoCard.issuedAt}
            expiresAt={issuedDemoCard.expiresAt}
          />
          <DemoPurchasePanel
            onPurchase={runPurchase}
            busy={purchaseBusy}
            flash={purchaseFlash}
            declineReason={result?.transaction.declineReason}
          />
          {demoError && <p className="text-sm text-rose-700">{demoError}</p>}
        </div>
      )}

      {step === 5 && result && (
        <DemoOutcome result={result} onReset={handleReset} />
      )}
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Live Agent Demo
            </h2>
            <Badge variant="simulated">{source === 'live' ? 'Live backend' : 'Simulation'}</Badge>
          </div>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {source === 'live'
              ? 'Card issuing and purchases run on the live backend: real policy engine, sandbox card provider, no real payments.'
              : 'Cinematic walkthrough with simulated SMS and sandbox cards — not live Photon or Visa authorization.'}
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

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(260px,300px)_1fr] lg:gap-10">
        <div className="mx-auto w-full max-w-[300px] lg:sticky lg:top-24 lg:mx-0">
          <PhoneConversation
            mode="controlled"
            phase={phonePhase}
            cardLastFour={issuedDemoCard?.lastFour}
          />
        </div>
        <div className="min-w-0">{rightPanel}</div>
      </div>
    </div>
  )
}
