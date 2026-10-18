import { CheckCircle2, RotateCcw, Shield, Wallet } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PARSED_REQUEST } from '../../demo/liveAgentScenario'
import { formatCurrencyPrecise } from '../../lib/format'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { PhoneConversation } from '../phone/PhoneConversation'

type HeroAct = 'lock' | 'notification' | 'conversation' | 'outcome'

const FLOAT_CARDS = [
  {
    icon: Shield,
    title: 'Policy passed',
    body: 'Budget · worker limit · MCC 5074',
    className: 'landing-float-card landing-float-1 -left-2 top-8 sm:-left-16',
  },
  {
    icon: Wallet,
    title: 'Sandbox card',
    body: `${formatCurrencyPrecise(PARSED_REQUEST.amountCents)} cap · 4h expiry`,
    className: 'landing-float-card landing-float-2 -right-2 top-[42%] sm:-right-14',
  },
  {
    icon: CheckCircle2,
    title: 'Job HEN-1042',
    body: '$790 budget remaining',
    className: 'landing-float-card landing-float-3 -left-4 bottom-16 sm:-left-20',
  },
] as const

export function LandingHeroShowcase() {
  const reduced = usePrefersReducedMotion()
  const [act, setAct] = useState<HeroAct>('lock')
  const [replayKey, setReplayKey] = useState(0)
  const timers = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }, [])

  const schedule = useCallback(
    (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms)
      timers.current.push(id)
    },
    [],
  )

  const runStory = useCallback(() => {
    clearTimers()
    if (reduced) {
      setAct('conversation')
      return
    }
    setAct('lock')
    schedule(() => setAct('notification'), 1400)
    schedule(() => setAct('conversation'), 3200)
    schedule(() => setAct('outcome'), 11800)
  }, [clearTimers, reduced, schedule])

  useEffect(() => {
    runStory()
    return clearTimers
  }, [runStory, replayKey])

  const showFloats = act !== 'lock'

  return (
    <div className="relative mx-auto w-full max-w-[min(100%,380px)]">
      {FLOAT_CARDS.map((card) => (
        <div
          key={card.title}
          className={`pointer-events-none absolute z-0 hidden max-w-[168px] sm:block ${
            showFloats ? 'landing-float-visible' : 'opacity-0'
          } ${card.className}`}
        >
          <div className="landing-float-card-inner rounded-xl p-3">
            <card.icon className="h-4 w-4 text-indigo-300" strokeWidth={1.5} />
            <p className="mt-2 text-[11px] font-semibold text-white">{card.title}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-white/55">{card.body}</p>
          </div>
        </div>
      ))}

      {/* Fixed, viewport-aware width keeps the hero height stable across acts */}
      <div className="landing-hero-phone relative z-10">
        {act === 'lock' || act === 'notification' ? (
          <PhoneConversation
            key={`intro-${replayKey}`}
            mode="hero-intro"
            heroAct={act}
            heroEntrance
          />
        ) : (
          <PhoneConversation
            key={`story-${replayKey}`}
            mode="autoplay"
            heroEntrance={false}
            hideReplay
            cinematicPurchaseBeat={act === 'outcome'}
          />
        )}
      </div>

      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => setReplayKey((k) => k + 1)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/12 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
          Replay story
        </button>
        <Link
          to="/live-demo"
          className="text-sm font-medium text-indigo-300/90 transition hover:text-indigo-200"
        >
          Skip to interactive demo →
        </Link>
      </div>
    </div>
  )
}
