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

/** In-thread card: the same graphite, chip and SANDBOX language as the landing's 3D card. */
function MiniSandboxCard({ lastFour = '4821' }: { lastFour?: string }) {
  return (
    <div className="relative mt-2 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#2b2d34_0%,#15161b_55%,#1c1b27_100%)] p-3 text-white shadow-lg ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold">
          <span className="flex h-4 w-4 items-center justify-center rounded bg-indigo-500 text-[7px] font-bold">FC</span>
          Fieldcard
        </span>
        <span className="rounded-full border border-amber-300/60 bg-amber-300/10 px-1.5 py-px font-mono text-[8px] font-bold tracking-widest text-amber-200">
          SANDBOX
        </span>
      </div>
      <div className="mt-2 h-4 w-6 rounded-[4px] bg-gradient-to-br from-[#f4e5b2] via-[#c9aa63] to-[#ecd99f] ring-1 ring-black/10" />
      <p className="mt-2 font-mono text-[13px] tracking-[0.18em]">
        •••• <span className="font-semibold">{lastFour}</span>
      </p>
      <p className="mt-1.5 text-[10px] text-slate-300">
        Cap {formatCurrencyPrecise(PARSED_REQUEST.amountCents)} · MCC 5074 · 4h
      </p>
      <p className="mt-0.5 text-[9px] text-indigo-200/90">Simulation — not a live Visa card</p>
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
  emptyHint = 'Simulated SMS thread · press Start simulation',
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
      <IPhoneFrame heroEntrance={heroEntrance} statusBarTheme="light" dark>
        <div className="flex h-full min-h-0 flex-col bg-black">
          <div className="flex shrink-0 flex-col items-center border-b border-white/10 bg-[#0b0b0d]/95 px-4 pb-2 pt-1 backdrop-blur-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#7c7cf8] to-[#4338ca] text-[10px] font-bold text-white">
              FC
            </span>
            <p className="mt-1 text-center text-xs font-semibold text-white">Fieldcard</p>
            <p className="text-center text-[10px] text-white/50">{DEMO_CONTEXT.company}</p>
          </div>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3 phone-messages-scroll"
            aria-live="polite"
          >
            {messagesEmpty ? (
              <p className="py-8 text-center text-[11px] text-white/45">
                {emptyHint}
              </p>
            ) : (
              <>
                <p className="text-center text-[10px] text-white/45">Simulated SMS · Today 9:41 AM</p>

                {visible.worker && (
                  <div className="phone-msg-in flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-b from-[#1a8cff] to-[#0a74ea] px-3 py-2 text-[14px] leading-snug text-white shadow-sm">
                      {SMS_WORKER_MESSAGE}
                    </div>
                  </div>
                )}

                {visible.typing && (
                  <div className="flex justify-start">
                    <div className="typing-bubble rounded-2xl rounded-bl-md bg-[#26262a] px-3 py-2.5">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                )}

                {visible.agentChecking && (
                  <div className="phone-msg-in flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-[#26262a] px-3 py-2 text-[14px] leading-snug text-[#f2f2f7] shadow-sm">
                      {SMS_AGENT_CHECKING}
                    </div>
                  </div>
                )}

                {visible.policy && (
                  <div className="phone-msg-in flex justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1.5 text-[11px] font-medium text-indigo-100">
                      <span className="policy-spinner h-3 w-3 rounded-full border-2 border-indigo-300 border-t-indigo-600" />
                      Policy engine running…
                    </div>
                  </div>
                )}

                {visible.agentApproved && (
                  <div className="phone-msg-in flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-[#26262a] px-3 py-2 text-[14px] leading-snug text-[#f2f2f7] shadow-sm">
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
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-[11px] font-semibold text-emerald-200">
                      <CreditCard className="h-3.5 w-3.5" />
                      Purchase approved · Ferguson
                    </div>
                  </div>
                )}

                {visible.purchaseDeclined && (
                  <div className="phone-msg-in flex justify-center">
                    <div className="flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-[11px] font-semibold text-rose-200">
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
