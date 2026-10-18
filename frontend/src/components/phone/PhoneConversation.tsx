import { CreditCard, RotateCcw, Shield } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEMO_CONTEXT,
  SMS_AGENT_APPROVED,
  SMS_AGENT_CHECKING,
  SMS_WORKER_MESSAGE,
  type PhoneConversationPhase,
} from '../../demo/smsConversation'
import { PARSED_REQUEST } from '../../demo/liveAgentScenario'
import { formatCurrencyPrecise } from '../../lib/format'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { IPhoneFrame } from './IPhoneFrame'
import { PhoneLockScreen } from './PhoneLockScreen'
import { HeroNotification } from './HeroNotification'

type AutoplayStep =
  | 'idle'
  | 'worker'
  | 'typing1'
  | 'agent1'
  | 'policy'
  | 'agent2'
  | 'card'
  | 'purchase'
  | 'done'

const AUTOPLAY_ORDER: AutoplayStep[] = [
  'idle',
  'worker',
  'typing1',
  'agent1',
  'policy',
  'agent2',
  'card',
  'purchase',
  'done',
]

function phaseToVisible(phase: PhoneConversationPhase): {
  worker: boolean
  typing: boolean
  agentChecking: boolean
  policy: boolean
  agentApproved: boolean
  card: boolean
  purchaseApproved: boolean
  purchaseDeclined: boolean
} {
  const rank = (p: PhoneConversationPhase) => {
    const order: PhoneConversationPhase[] = [
      'intro',
      'worker-sms',
      'typing-check',
      'agent-checking',
      'policy-processing',
      'agent-approved',
      'card-revealed',
      'purchase-approved',
      'purchase-declined',
    ]
    return order.indexOf(p)
  }
  const r = rank(phase)
  return {
    worker: r >= rank('worker-sms'),
    typing: phase === 'typing-check',
    agentChecking: r >= rank('agent-checking'),
    policy: phase === 'policy-processing',
    agentApproved: r >= rank('agent-approved'),
    card: r >= rank('card-revealed'),
    purchaseApproved: phase === 'purchase-approved',
    purchaseDeclined: phase === 'purchase-declined',
  }
}

function MiniSandboxCard({ lastFour = '4821' }: { lastFour?: string }) {
  return (
    <div className="mt-2 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-3 text-white shadow-lg">
      <p className="text-[9px] uppercase tracking-widest text-slate-400">Sandbox card</p>
      <p className="mt-1 font-mono text-sm tracking-wider">•••• {lastFour}</p>
      <p className="mt-2 text-[10px] text-slate-300">
        Cap {formatCurrencyPrecise(PARSED_REQUEST.amountCents)} · MCC 5074
      </p>
      <p className="mt-1 text-[9px] text-indigo-200/90">Simulation — not a live Visa card</p>
    </div>
  )
}

export function PhoneConversation({
  mode = 'controlled',
  phase = 'intro',
  heroEntrance = false,
  className = '',
  heroAct = 'lock',
  cinematicPurchaseBeat = false,
  cardLastFour,
  hideReplay = false,
  emptyHint = 'Simulated SMS thread · tap Start on the right',
}: {
  mode?: 'autoplay' | 'controlled' | 'hero-intro'
  phase?: PhoneConversationPhase
  heroEntrance?: boolean
  className?: string
  heroAct?: 'lock' | 'notification'
  cinematicPurchaseBeat?: boolean
  cardLastFour?: string
  hideReplay?: boolean
  /** Copy shown in controlled mode before the first message */
  emptyHint?: string
}) {
  const reduced = usePrefersReducedMotion()
  const [autoplayStep, setAutoplayStep] = useState<AutoplayStep>('idle')
  const [replayKey, setReplayKey] = useState(0)
  const timers = useRef<number[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  const runAutoplay = useCallback(() => {
    clearTimers()
    setAutoplayStep('idle')
    if (reduced) {
      setAutoplayStep('done')
      return
    }
    const delays: Record<AutoplayStep, number> = {
      idle: 350,
      worker: 1100,
      typing1: 850,
      agent1: 1300,
      policy: 1500,
      agent2: 1100,
      card: 900,
      purchase: 1200,
      done: 0,
    }
    let i = 0
    const tick = () => {
      const step = AUTOPLAY_ORDER[i]
      if (!step) return
      if (step === 'purchase' && !cinematicPurchaseBeat) {
        setAutoplayStep('done')
        return
      }
      setAutoplayStep(step)
      i += 1
      if (AUTOPLAY_ORDER[i]) {
        const id = window.setTimeout(tick, delays[step])
        timers.current.push(id)
      }
    }
    const id = window.setTimeout(tick, delays.idle)
    timers.current.push(id)
  }, [reduced, cinematicPurchaseBeat])

  useEffect(() => {
    if (mode === 'autoplay') runAutoplay()
    return clearTimers
  }, [mode, runAutoplay, replayKey])

  useEffect(() => {
    if (
      mode === 'autoplay' &&
      cinematicPurchaseBeat &&
      (autoplayStep === 'card' || autoplayStep === 'done')
    ) {
      setAutoplayStep('purchase')
    }
  }, [cinematicPurchaseBeat, autoplayStep, mode])

  const controlled = phaseToVisible(phase)

  const visible =
    mode === 'controlled'
      ? controlled
      : mode === 'hero-intro'
        ? {
            worker: false,
            typing: false,
            agentChecking: false,
            policy: false,
            agentApproved: false,
            card: false,
            purchaseApproved: false,
            purchaseDeclined: false,
          }
        : {
            worker: ['worker', 'typing1', 'agent1', 'policy', 'agent2', 'card', 'purchase', 'done'].includes(
              autoplayStep,
            ),
            typing: autoplayStep === 'typing1',
            agentChecking: ['agent1', 'policy', 'agent2', 'card', 'purchase', 'done'].includes(
              autoplayStep,
            ),
            policy: autoplayStep === 'policy',
            agentApproved: ['agent2', 'card', 'purchase', 'done'].includes(autoplayStep),
            card: ['card', 'purchase', 'done'].includes(autoplayStep),
            purchaseApproved:
              autoplayStep === 'purchase' || autoplayStep === 'done',
            purchaseDeclined: false,
          }

  // Scroll only the thread itself — scrollIntoView would also scroll the page.
  useEffect(() => {
    const thread = scrollRef.current
    thread?.scrollTo({ top: thread.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })
  }, [
    visible.worker,
    visible.typing,
    visible.agentChecking,
    visible.policy,
    visible.agentApproved,
    visible.card,
    visible.purchaseApproved,
    visible.purchaseDeclined,
    reduced,
  ])

  const handleReplay = () => {
    setReplayKey((k) => k + 1)
  }

  if (mode === 'hero-intro') {
    return (
      <div className={className}>
        <IPhoneFrame heroEntrance={heroEntrance} fullBleed statusBarTheme="light">
          <PhoneLockScreen />
          {heroAct === 'notification' && (
            <div className="absolute inset-x-0 top-[52px] z-20">
              <HeroNotification />
            </div>
          )}
        </IPhoneFrame>
      </div>
    )
  }

  const messagesEmpty = mode === 'controlled' && phase === 'intro'

  return (
    <div className={className}>
      <IPhoneFrame heroEntrance={heroEntrance}>
        <div className="flex h-full min-h-0 flex-col bg-[#f2f2f7]">
          <div className="shrink-0 border-b border-black/5 bg-[#f2f2f7]/95 px-4 py-2 backdrop-blur-sm">
            <p className="text-center text-xs font-semibold text-black">Fieldcard</p>
            <p className="text-center text-[10px] text-black/50">{DEMO_CONTEXT.company}</p>
          </div>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 phone-messages-scroll"
            aria-live="polite"
          >
            {messagesEmpty ? (
              <p className="py-8 text-center text-[11px] text-black/40">
                {emptyHint}
              </p>
            ) : (
              <>
                <p className="text-center text-[10px] text-black/40">Today 9:41 AM · Simulated SMS</p>

                {visible.worker && (
                  <div className="phone-msg-in flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#007aff] px-3 py-2 text-[13px] leading-snug text-white shadow-sm">
                      {SMS_WORKER_MESSAGE}
                    </div>
                  </div>
                )}

                {visible.typing && (
                  <div className="flex justify-start">
                    <div className="typing-bubble rounded-2xl rounded-bl-md bg-[#e5e5ea] px-3 py-2.5">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                )}

                {visible.agentChecking && (
                  <div className="phone-msg-in flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[#e5e5ea] px-3 py-2 text-[13px] leading-snug text-black shadow-sm">
                      {SMS_AGENT_CHECKING}
                    </div>
                  </div>
                )}

                {visible.policy && (
                  <div className="phone-msg-in flex justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-medium text-indigo-800">
                      <span className="policy-spinner h-3 w-3 rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                      Policy engine running…
                    </div>
                  </div>
                )}

                {visible.agentApproved && (
                  <div className="phone-msg-in flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-[#e5e5ea] px-3 py-2 text-[13px] leading-snug text-black shadow-sm">
                      {SMS_AGENT_APPROVED}
                    </div>
                  </div>
                )}

                {visible.card && (
                  <div className="phone-msg-in px-1">
                    <MiniSandboxCard lastFour={cardLastFour} />
                  </div>
                )}

                {visible.purchaseApproved && (
                  <div className="phone-msg-in flex justify-center">
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-800">
                      <CreditCard className="h-3.5 w-3.5" />
                      Purchase approved · Ferguson
                    </div>
                  </div>
                )}

                {visible.purchaseDeclined && (
                  <div className="phone-msg-in flex justify-center">
                    <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-800">
                      <Shield className="h-3.5 w-3.5" />
                      Blocked · MCC 5200 not allowed
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </IPhoneFrame>

      {mode === 'autoplay' && !hideReplay && (
        <button
          type="button"
          onClick={handleReplay}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
          Replay conversation
        </button>
      )}
    </div>
  )
}
