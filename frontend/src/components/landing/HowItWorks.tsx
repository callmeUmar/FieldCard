import { BadgeCheck, Check, CreditCard, MessageSquareText, ScanText, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { HOW_IT_WORKS as H } from './landingSectionsData'
import { SectionIntro } from './SectionIntro'

/*
 * How it works — five steps that light up as each one crosses the middle of the
 * viewport. A single IntersectionObserver drives the active step; everything
 * else (connector fill, artifact swap, typography) is CSS transitions.
 */

type Step = { kicker: string; title: string; body: string; icon: typeof Check; artifact: () => ReactNode }

const STEPS: Step[] = [
  {
    kicker: 'SMS request',
    title: `${H.worker} texts what he needs.`,
    body: 'No app to open. A plain text from the counter names the job, the store and the amount.',
    icon: MessageSquareText,
    artifact: () => <SmsArtifact />,
  },
  {
    kicker: 'AI interpretation',
    title: 'The message becomes a structured request.',
    body: 'Job code, worker, merchant, category and amount are pulled out, so rules run on facts — not free text.',
    icon: ScanText,
    artifact: () => <ParsedArtifact />,
  },
  {
    kicker: 'Policy evaluation',
    title: 'Your rules run before money moves.',
    body: 'Job status, worker limit, remaining budget, merchant category and approval threshold — each checked in turn.',
    icon: ShieldCheck,
    artifact: () => <PolicyArtifact />,
  },
  {
    kicker: 'Sandbox card',
    title: 'A card is issued for exactly this purchase.',
    body: `Capped at ${H.card.cap}, locked to MCC ${H.card.mccs}, single-use, and closed after ${H.card.hours} hours.`,
    icon: CreditCard,
    artifact: () => <CardArtifact />,
  },
  {
    kicker: 'Result',
    title: 'The authorization posts to the job.',
    body: `Approved at the counter and coded to ${H.result.jobCode} — ${H.result.remaining} left on the materials budget.`,
    icon: BadgeCheck,
    artifact: () => <ResultArtifact />,
  },
]

const N = STEPS.length

export function HowItWorks() {
  const reduced = usePrefersReducedMotion()
  const [active, setActive] = useState(0)
  const stepRefs = useRef<(HTMLLIElement | null)[]>([])

  useEffect(() => {
    const els = stepRefs.current.filter(Boolean) as HTMLLIElement[]
    // A zero-height band at the viewport's middle: whichever step crosses it is active
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index))
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  const goTo = (i: number) => {
    setActive(i)
    stepRefs.current[i]?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <section id="how-it-works" className="lx-section lx-hiw" aria-labelledby="hiw-heading">
      <div className="lx-container">
        <SectionIntro id="hiw-heading" kicker="How it works" title="From a text to a coded purchase.">
          Five steps, a few seconds, no new app for your crew.
        </SectionIntro>

        <div className="lx-hiw-grid">
          <ol className="lx-hiw-steps">
            {STEPS.map((step, i) => {
              const state = i < active ? 'done' : i === active ? 'active' : 'next'
              const Icon = step.icon
              return (
                <li
                  key={step.kicker}
                  ref={(el) => {
                    stepRefs.current[i] = el
                  }}
                  data-index={i}
                  data-state={state}
                  className="lx-hiw-step"
                >
                  <button
                    type="button"
                    className="lx-hiw-head"
                    onClick={() => goTo(i)}
                    aria-current={i === active ? 'step' : undefined}
                  >
                    <span className="lx-hiw-node" aria-hidden>
                      <Icon className="lx-hiw-node-icon" strokeWidth={1.75} />
                      <Check className="lx-hiw-node-check" strokeWidth={2.5} />
                    </span>
                    <span className="lx-hiw-head-text">
                      <span className="lx-hiw-kicker">
                        {String(i + 1).padStart(2, '0')} · {step.kicker}
                      </span>
                      <span className="lx-hiw-title">{step.title}</span>
                    </span>
                  </button>
                  <p className="lx-hiw-body">{step.body}</p>
                  <div className="lx-hiw-inline">{step.artifact()}</div>
                </li>
              )
            })}
          </ol>

          <div className="lx-hiw-visual" aria-hidden>
            <div className="lx-hiw-panel">
              <div className="lx-hiw-panel-head">
                <span className="lx-hiw-count">
                  <span key={active} className="lx-hiw-count-num">
                    {String(active + 1).padStart(2, '0')}
                  </span>
                  <span className="lx-hiw-count-total"> / {String(N).padStart(2, '0')}</span>
                </span>
                <span className="lx-hiw-ticks">
                  {STEPS.map((s, i) => (
                    <span key={s.kicker} className="lx-hiw-tick" data-on={i <= active} />
                  ))}
                </span>
                <span className="lx-chip">Sandbox</span>
              </div>
              <div className="lx-hiw-stage">
                {STEPS.map((step, i) => (
                  <div
                    key={step.kicker}
                    className="lx-hiw-artifact"
                    data-state={i === active ? 'active' : i < active ? 'before' : 'after'}
                  >
                    <p className="lx-hiw-artifact-label">{step.kicker}</p>
                    {step.artifact()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------- Artifacts (small, schematic, data-true) ---------------- */

function SmsArtifact() {
  return (
    <div className="lx-art lx-art-sms">
      <p className="lx-art-meta">
        <span className="lx-avatar">{H.worker[0]}</span>
        {H.worker} · SMS
      </p>
      <p className="lx-sms-bubble">{H.sms}</p>
    </div>
  )
}

function ParsedArtifact() {
  return (
    <dl className="lx-art lx-art-rows">
      {H.parsed.map(([k, v], i) => (
        <div key={k} className="lx-art-row" style={{ '--i': i } as CSSProperties}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function PolicyArtifact() {
  return (
    <ul className="lx-art lx-art-rows">
      {H.rules.map((r, i) => (
        <li key={r.id} className="lx-art-row lx-art-rule" style={{ '--i': i } as CSSProperties}>
          <span className="lx-rule-mark" data-passed={r.passed}>
            <Check strokeWidth={2.5} />
          </span>
          <span className="lx-rule-text">
            <span className="lx-rule-title">{r.title}</span>
            <span className="lx-rule-detail">{r.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function CardArtifact() {
  return (
    <div className="lx-art">
      <div className="lx-mini-card">
        <div className="lx-mini-card-top">
          <span>Fieldcard</span>
          <span className="lx-chip lx-chip-dark">Sandbox</span>
        </div>
        <p className="lx-mini-card-num">•••• {H.card.lastFour}</p>
        <div className="lx-mini-card-grid">
          <span>Cap</span>
          <strong>{H.card.cap}</strong>
          <span>MCC</span>
          <strong>{H.card.mccs}</strong>
          <span>Uses</span>
          <strong>Single-use</strong>
          <span>Expires</span>
          <strong>+{H.card.hours}h</strong>
        </div>
      </div>
    </div>
  )
}

function ResultArtifact() {
  return (
    <div className="lx-art lx-art-result">
      <span className="lx-result-badge">
        <Check strokeWidth={2.5} /> Approved
      </span>
      <p className="lx-result-amount">{H.result.amount}</p>
      <p className="lx-result-merchant">{H.result.merchant}</p>
      <div className="lx-result-foot">
        <span>Posted to {H.result.jobCode}</span>
        <span>{H.result.remaining} left</span>
      </div>
      <p className="lx-art-note">Sandbox authorization · no real payment</p>
    </div>
  )
}
