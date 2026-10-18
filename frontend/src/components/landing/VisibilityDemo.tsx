import { Activity, Check, Clock3, CreditCard, Gauge, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useInView } from '../../hooks/useInView'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { formatCurrencyPrecise, formatRelativeTime } from '../../lib/format'
import { VISIBILITY as V } from './landingSectionsData'
import { SectionIntro } from './SectionIntro'

/*
 * Complete visibility — the canonical Henderson purchase rippling through the
 * owner's dashboard: Purchase → Authorization → Job budget → Activity.
 * Plays once when scrolled into view; each stage can also be picked directly.
 * Purely presentational: nothing is executed or stored.
 */

const usd = formatCurrencyPrecise

const STAGES = [
  { label: 'Purchase', icon: CreditCard },
  { label: 'Authorization', icon: ShieldCheck },
  { label: 'Job budget', icon: Gauge },
  { label: 'Activity', icon: Activity },
] as const

/** Phase 0 is the "before" state; phase n means stage n has happened */
const CAPTIONS = [
  `${V.job.code}: ${usd(V.before.spentCents)} of ${usd(V.budgetCents)} spent.`,
  `${V.job.worker} pays ${V.purchase.merchant} ${usd(V.purchase.amountCents)}.`,
  `Approved. ${V.purchase.checksPassed} of ${V.purchase.checksTotal} checks passed.`,
  `Spent ${usd(V.after.spentCents)}. ${usd(V.after.remainingCents)} left.`,
  `Logged, coded to ${V.job.code}.`,
]

const PHASE_AT_MS = [0, 500, 1500, 2600, 3900]
const FINAL = STAGES.length

export function VisibilityDemo() {
  const reduced = usePrefersReducedMotion()
  // Start once the board's top passes ~55% of the viewport — works for the tall stacked mobile layout too
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0, rootMargin: '0px 0px -45% 0px' })
  const [phase, setPhase] = useState(0)
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }

  /** Timers only — reduced motion jumps straight to the final state */
  const schedule = useCallback(() => {
    clear()
    const steps = reduced ? [[0, FINAL]] : PHASE_AT_MS.map((at, p) => [at, p]).slice(1)
    for (const [at, p] of steps) timers.current.push(window.setTimeout(() => setPhase(p), at))
  }, [reduced])

  useEffect(() => {
    if (inView) schedule()
    return clear
  }, [inView, schedule])

  const replay = () => {
    setPhase(0)
    schedule()
  }

  const pick = (p: number) => {
    clear()
    setPhase(p)
  }

  // Budget figures count up once the purchase posts; going back (replay) snaps to "before"
  const budgetDone = phase >= 3
  const p = useCountUp(budgetDone, reduced)
  const spent = lerpCents(V.before.spentCents, V.after.spentCents, p)
  const remaining = lerpCents(V.before.remainingCents, V.after.remainingCents, p)
  const barBefore = V.before.spentCents / V.budgetCents
  const barAfter = V.after.spentCents / V.budgetCents

  return (
    <section id="visibility" className="lx-section lx-vis" aria-labelledby="vis-heading">
      <div className="lx-container">
        <SectionIntro id="vis-heading" kicker="The owner dashboard" title="Complete visibility.">
          Each purchase posts to its job as it clears.
        </SectionIntro>

        <div ref={ref} className="lx-vis-wrap" data-phase={phase}>
          <ol className="lx-vis-chain" aria-label="What happens after a purchase">
            {STAGES.map((stage, i) => {
              const Icon = stage.icon
              const n = i + 1
              return (
                <li key={stage.label} className="lx-vis-link" data-on={phase >= n} data-current={phase === n}>
                  <button
                    type="button"
                    className="lx-vis-node"
                    onClick={() => pick(n)}
                    aria-pressed={phase === n}
                  >
                    <span className="lx-vis-node-icon" aria-hidden>
                      <Icon strokeWidth={1.75} />
                    </span>
                    <span className="lx-vis-node-label">{stage.label}</span>
                  </button>
                </li>
              )
            })}
          </ol>

          <div className="lx-vis-caption-row">
            <p className="lx-vis-caption" aria-live="polite">
              <span key={phase} className="lx-vis-caption-text">
                {CAPTIONS[phase]}
              </span>
            </p>
            <button type="button" className="lx-ghost-btn" onClick={replay}>
              <RotateCcw aria-hidden />
              Replay
            </button>
          </div>

          <div className="lx-board">
            <div className="lx-board-head">
              <div>
                <p className="lx-board-title">Owner dashboard</p>
                <p className="lx-board-sub">Ballard Plumbing &amp; Heat · {V.job.code}</p>
              </div>
              <span className="lx-chip">Sandbox data</span>
            </div>

            <div className="lx-board-grid">
              <div className="lx-board-card lx-board-txns" data-hot={phase === 1 || phase === 2}>
                <p className="lx-board-label">Transactions</p>
                <ul className="lx-txns">
                  <li className="lx-txn lx-txn-new" data-shown={phase >= 1}>
                    <div className="lx-txn-inner">
                      <span className="lx-txn-merchant">
                        {V.purchase.merchant}
                        <span className="lx-txn-sub">
                          •••• {V.purchase.cardLastFour} · MCC {V.purchase.mcc}
                        </span>
                      </span>
                      <span className="lx-num lx-txn-amount">{usd(V.purchase.amountCents)}</span>
                      <TxnStatus status={phase >= 2 ? V.purchase.status : 'authorizing'} />
                    </div>
                  </li>
                  {V.transactions.map((t) => (
                    <li key={t.id} className="lx-txn">
                      <div className="lx-txn-inner">
                        <span className="lx-txn-merchant">{t.merchant}</span>
                        <span className="lx-num lx-txn-amount">{usd(t.amountCents)}</span>
                        <TxnStatus status={t.status} />
                      </div>
                    </li>
                  ))}
                </ul>
                <TxnSummary includeNew={phase >= 2} />
              </div>

              <div className="lx-board-card lx-board-budget" data-hot={phase === 3}>
                <p className="lx-board-label">Job budget</p>
                <p className="lx-budget-job">
                  {V.job.code} · {V.job.name}
                </p>
                <div className="lx-budget-figures">
                  <div>
                    <span>Spent</span>
                    <strong className="lx-num">{usd(spent)}</strong>
                  </div>
                  <div>
                    <span>Remaining</span>
                    <strong className="lx-num">{usd(remaining)}</strong>
                  </div>
                </div>
                <div
                  className="lx-budget-bar"
                  style={{ '--b-before': barBefore, '--b-after': barAfter } as CSSProperties}
                  data-done={budgetDone}
                >
                  <span className="lx-budget-bar-base" />
                  <span className="lx-budget-bar-delta" />
                </div>
                <div className="lx-budget-foot">
                  <span>
                    {budgetDone ? V.after.percent : V.before.percent}% of {usd(V.budgetCents)}
                  </span>
                  <span className="lx-budget-delta" data-shown={budgetDone}>
                    +{usd(V.purchase.amountCents)}
                  </span>
                </div>
              </div>

              <div className="lx-board-card lx-board-activity" data-hot={phase === 4}>
                <p className="lx-board-label">Recent activity</p>
                <ul className="lx-feed">
                  <li className="lx-feed-item lx-feed-new" data-shown={phase >= 4}>
                    <div className="lx-feed-inner">
                      <span className="lx-feed-dot" />
                      <div>
                        <p className="lx-feed-title">Purchase approved</p>
                        <p className="lx-feed-desc">
                          {V.purchase.merchant} — {usd(V.purchase.amountCents)} on {V.job.name}
                        </p>
                      </div>
                      <span className="lx-feed-time">Just now</span>
                    </div>
                  </li>
                  {V.activities.map((a) => (
                    <li key={a.id} className="lx-feed-item">
                      <div className="lx-feed-inner">
                        <span className="lx-feed-dot lx-feed-dot-old" />
                        <div>
                          <p className="lx-feed-title">{a.title}</p>
                          <p className="lx-feed-desc">{a.description}</p>
                        </div>
                        <span className="lx-feed-time">{formatRelativeTime(a.timestamp)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** What the owner can act on, recounted when the new purchase clears */
function TxnSummary({ includeNew }: { includeNew: boolean }) {
  const statuses = [...V.transactions.map((t) => t.status), ...(includeNew ? [V.purchase.status] : [])]
  const count = (s: string) => statuses.filter((x) => x === s).length
  const items = [
    { status: 'approved', label: 'Approved' },
    { status: 'pending', label: 'Needs review' },
    { status: 'declined', label: 'Declined' },
  ]
  return (
    <dl className="lx-txn-summary">
      {items.map((it) => (
        <div key={it.status} data-status={it.status}>
          <dt>{it.label}</dt>
          <dd key={count(it.status)} className="lx-num">
            {count(it.status)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function TxnStatus({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof Check }> = {
    approved: { label: 'Approved', icon: Check },
    declined: { label: 'Declined', icon: X },
    pending: { label: 'Review', icon: Clock3 },
    authorizing: { label: 'Checking', icon: Clock3 },
  }
  const { label, icon: Icon } = map[status] ?? map.pending
  return (
    <span key={status} className="lx-status" data-status={status}>
      <Icon strokeWidth={2.5} aria-hidden />
      {label}
    </span>
  )
}

/** Lands exactly on `to` when p reaches 1 */
const lerpCents = (from: number, to: number, p: number) => (p >= 1 ? to : Math.round(from + (to - from) * p))

/** 0 → 1 (ease-out) over the duration while `active`; 0 when inactive, 1 with reduced motion. */
function useCountUp(active: boolean, reduced: boolean, durationMs = 900) {
  const [t, setT] = useState(0)

  useEffect(() => {
    if (!active || reduced) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const linear = Math.min(1, (now - start) / durationMs)
      setT(1 - Math.pow(1 - linear, 3))
      if (linear < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      setT(0)
    }
  }, [active, reduced, durationMs])

  if (!active) return 0
  return reduced ? 1 : t
}
