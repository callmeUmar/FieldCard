import { ArrowRight, CalendarClock, CheckCircle2, CircleDollarSign, Store } from 'lucide-react'
import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { DEMO_CONTEXT, type PhoneConversationPhase } from '../../demo/smsConversation'
import {
  BLOCKED_PURCHASE,
  DEMO_VIRTUAL_CARD,
  PARSED_REQUEST,
} from '../../demo/liveAgentScenario'
import { formatCurrencyPrecise } from '../../lib/format'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { useScrollProgress } from '../../hooks/useScrollProgress'
import { PhoneConversation } from '../phone/PhoneConversation'
import '../../styles/scroll-story.css'

/**
 * "Scroll to control" — presentation-only scroll story. Nothing here touches
 * the dashboard store or the Live Agent Demo state machine; the phone is driven
 * through PhoneConversation's controlled `phase` prop.
 *
 * Continuous motion is written as CSS variables on the section (no re-render
 * per frame). React state only changes at story beats: phone phase + chapter.
 */

const AMOUNT = formatCurrencyPrecise(PARSED_REQUEST.amountCents)

/** Phone thread beats, keyed by scroll progress (descending). */
const PHONE_BEATS: [number, PhoneConversationPhase][] = [
  [0.8, 'purchase-approved'],
  [0.44, 'card-revealed'],
  [0.38, 'agent-approved'],
  [0.31, 'policy-processing'],
  [0.25, 'agent-checking'],
  [0.19, 'typing-check'],
  [0.13, 'worker-sms'],
]

const CHAPTERS = [
  {
    from: 0,
    label: 'Request',
    title: 'It starts with a text.',
    body: `${DEMO_CONTEXT.worker} texts what he needs and which job it's for. No app to open, no company card in his wallet.`,
  },
  {
    from: 0.3,
    label: 'Policy',
    title: 'Rules run before money moves.',
    body: `Fieldcard checks the ${PARSED_REQUEST.jobCode} budget (${DEMO_CONTEXT.jobBudgetRemaining} left), ${DEMO_CONTEXT.worker}'s ${DEMO_CONTEXT.workerLimit} per-purchase limit and the merchant category.`,
  },
  {
    from: 0.44,
    label: 'Card',
    title: 'One request. One card.',
    body: 'A single-use sandbox card is issued for this purchase — and nothing else.',
  },
  {
    from: 0.58,
    label: 'Constraints',
    title: 'Locked to the job.',
    body: 'It can only spend the approved amount, only at plumbing suppliers, and only for the next four hours.',
  },
  {
    from: 0.76,
    label: 'Decision',
    title: 'Approved at the counter.',
    body: `${PARSED_REQUEST.merchant} charges ${AMOUNT} under MCC ${PARSED_REQUEST.mcc}. Every constraint holds, so the sandbox authorization clears.`,
  },
  {
    from: 0.9,
    label: 'Demo',
    title: 'Now run it yourself.',
    body: `Send the text yourself, then try the same card at ${BLOCKED_PURCHASE.merchant} (MCC ${BLOCKED_PURCHASE.mcc}).`,
    cta: true,
  },
] as const

const CONSTRAINTS = [
  {
    icon: CircleDollarSign,
    label: 'Spend cap',
    value: AMOUNT,
    reveal: 'var(--c1)',
  },
  {
    icon: Store,
    label: 'Merchant category',
    value: `MCC ${PARSED_REQUEST.mcc}`,
    reveal: 'var(--c2)',
  },
  {
    icon: CalendarClock,
    label: 'Expires',
    value: '4 hours',
    reveal: 'var(--c3)',
  },
] as const

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
/** Smoothstep-eased progress of `p` across [a, b]. */
const span = (p: number, a: number, b: number) => {
  const t = clamp01((p - a) / (b - a))
  return t * t * (3 - 2 * t)
}

function phaseAt(p: number): PhoneConversationPhase {
  return PHONE_BEATS.find(([at]) => p >= at)?.[1] ?? 'intro'
}

function chapterAt(p: number): number {
  let index = 0
  CHAPTERS.forEach((c, i) => {
    if (p >= c.from) index = i
  })
  return index
}

export function ScrollToControlSection() {
  const reduced = usePrefersReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const [phaseState, setPhase] = useState<PhoneConversationPhase>('intro')
  const [chapterState, setChapter] = useState(0)

  const onProgress = useCallback((p: number) => {
    const style = sectionRef.current?.style
    if (!style) return
    style.setProperty('--p', p.toFixed(4))
    style.setProperty('--enter', span(p, 0, 0.12).toFixed(4))
    style.setProperty('--focus', span(p, 0.44, 0.57).toFixed(4))
    style.setProperty('--c1', span(p, 0.58, 0.63).toFixed(4))
    style.setProperty('--c2', span(p, 0.63, 0.68).toFixed(4))
    style.setProperty('--c3', span(p, 0.68, 0.73).toFixed(4))
    style.setProperty('--decide', span(p, 0.78, 0.87).toFixed(4))
    setPhase(phaseAt(p))
    setChapter(chapterAt(p))
  }, [])

  // Start counting while the section is still entering, so the phone's
  // entrance overlaps the approach instead of revealing an empty stage.
  useScrollProgress(sectionRef, onProgress, { enabled: !reduced, lead: 0.6 })

  // Reduced motion: no scroll choreography — show the resolved story.
  const phase = reduced ? 'purchase-approved' : phaseState
  const chapter = reduced ? CHAPTERS.length - 1 : chapterState

  return (
    <section
      ref={sectionRef}
      id="scroll-to-control"
      className="story"
      data-static={reduced || undefined}
      aria-labelledby="story-heading"
    >
      <div className="story-stage">
        <div className="story-inner mx-auto max-w-6xl px-4 sm:px-6">
          <div className="story-copy">
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id="story-heading"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80"
              >
                Scroll to control
              </h2>
              <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
                Sandbox simulation
              </span>
            </div>

            <div className="story-chapters mt-5 lg:mt-8">
              {CHAPTERS.map((c, i) => (
                <article
                  key={c.label}
                  className="story-chapter"
                  data-state={i < chapter ? 'past' : i === chapter ? 'active' : 'next'}
                >
                  <p className="text-[11px] font-medium tabular-nums text-white/40">
                    {String(i + 1).padStart(2, '0')} — {c.label}
                  </p>
                  <h3 className="mt-2 text-[1.6rem] font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-3xl lg:text-[2.6rem]">
                    {c.title}
                  </h3>
                  <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/60 lg:mt-5 lg:text-base">
                    {c.body}
                  </p>
                  {'cta' in c && (
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 lg:mt-8">
                      <Link
                        to="/live-demo"
                        tabIndex={i === chapter ? undefined : -1}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400"
                      >
                        Launch interactive demo
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <span className="hidden text-xs text-white/40 sm:inline">
                        Simulated SMS · sandbox cards · no real payments
                      </span>
                    </div>
                  )}
                </article>
              ))}
            </div>

            <ol className="story-rail" aria-hidden>
              {CHAPTERS.map((c, i) => (
                <li key={c.label} data-done={i <= chapter || undefined}>
                  <span>{c.label}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="story-scene">
            <div className="story-light" aria-hidden />

            <div className="story-phone">
              <PhoneConversation
                mode="controlled"
                phase={phase}
                cardLastFour={DEMO_VIRTUAL_CARD.lastFour}
                emptyHint="Today 9:41 AM · Simulated SMS"
              />
            </div>

            <div className="story-stack">
              <div className="story-card">
                <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" aria-hidden />
                <div className="absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-indigo-500/10" aria-hidden />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-semibold tracking-tight">Fieldcard</p>
                    <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-indigo-100">
                      Sandbox
                    </span>
                  </div>
                  <div>
                    <div className="story-card-chip" aria-hidden />
                    <p className="mt-3 font-mono text-[15px] tracking-[0.18em] sm:text-base">
                      •••• •••• •••• {DEMO_VIRTUAL_CARD.lastFour}
                    </p>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-slate-400">Single-use</p>
                      <p className="mt-0.5 text-xs text-slate-200">
                        {DEMO_CONTEXT.worker} · {PARSED_REQUEST.jobCode}
                      </p>
                    </div>
                    <p className="max-w-[9rem] text-right text-[9px] leading-snug text-indigo-200/80">
                      Simulation — not a live Visa card
                    </p>
                  </div>
                </div>
              </div>

              <ul className="story-constraints" aria-label="Card constraints">
                {CONSTRAINTS.map((c) => (
                  <li
                    key={c.label}
                    className="story-constraint"
                    style={{ '--reveal': c.reveal } as CSSProperties}
                  >
                    <c.icon className="h-4 w-4 shrink-0 text-indigo-300" strokeWidth={1.5} />
                    <span className="whitespace-nowrap text-[13px] text-white/55">{c.label}</span>
                    <span className="ml-auto whitespace-nowrap text-[13px] font-semibold tabular-nums text-white">
                      {c.value}
                    </span>
                    <CheckCircle2
                      className="story-check h-4 w-4 shrink-0 text-emerald-400"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </li>
                ))}
              </ul>

              <div className="story-decision">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <span>Sandbox authorization</span>
                  <span>Simulated</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-white">
                      {PARSED_REQUEST.merchant}
                    </p>
                    <p className="text-xs tabular-nums text-white/50">
                      {AMOUNT} · MCC {PARSED_REQUEST.mcc}
                    </p>
                  </div>
                  <span className="story-verdict">
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                    Approved
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="story-progress" aria-hidden>
          <span />
        </div>
      </div>
    </section>
  )
}
