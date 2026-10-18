import { Check } from 'lucide-react'
import { BEATS, JOB_IMPACT } from './story'

/** Copy blocks shared by the cinematic overlay and the static fallback. */

export function HeroCopy({ beat = false }: { beat?: boolean }) {
  return (
    <div className="cine-hero" data-beat={beat ? 'hero' : undefined}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8f8ff7]">How it works</p>
      <h2 className="mt-5 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.6rem]">
        One text. One card.
      </h2>
      <p className="mt-5 text-lg text-white/60">Scroll to follow one purchase.</p>
    </div>
  )
}

export function BeatCopy({ id, as: Heading = 'h2' }: { id: keyof typeof BEATS; as?: 'h2' | 'h3' }) {
  const b = BEATS[id]
  return (
    <>
      <p data-part className="cine-kicker">
        {b.kicker}
      </p>
      <Heading data-part className="cine-title">
        {b.title}
      </Heading>
      <p data-part className="cine-body">
        {b.body}
      </p>
    </>
  )
}

/** Two values in one cell: the timeline swaps them; the static story shows the second. */
function Swap({ from, to, className = '' }: { from: string; to: string; className?: string }) {
  return (
    <span className={`cine-swap ${className}`}>
      <span data-from>{from}</span>
      <span data-to>{to}</span>
    </span>
  )
}

/**
 * The owner-dashboard view of the approved purchase: the HEN-1042 job before and
 * after $186.50 posts. Presentation only — values come from JOB_IMPACT.
 */
export function JobImpactPanel({ resolved = false }: { resolved?: boolean }) {
  const j = JOB_IMPACT
  return (
    <div className="cine-panel" data-panel data-resolved={resolved || undefined}>
      <p className="sr-only">
        Sandbox preview: after the {j.amount} purchase at {j.merchant}, spending on {j.jobName} ({j.code}) rises from{' '}
        {j.spentBefore} to {j.spentAfter}, and the remaining budget falls from {j.remainingBefore} to {j.remainingAfter}.
      </p>
      <div aria-hidden>
        <div className="cine-panel-head">
          <span className="cine-panel-brand">
            <span className="cine-panel-mark">FC</span>
            Owner dashboard
          </span>
          <span className="cine-panel-pill">Sandbox preview</span>
        </div>

        <div className="cine-panel-job">
          <p className="cine-panel-job-name">{j.jobName}</p>
          <p className="cine-panel-job-meta">
            {j.code} · {j.worker} · Plumbing
          </p>
        </div>

        <dl className="cine-stats">
          <div>
            <dt>Spent</dt>
            <dd className="cine-stat-value">
              <Swap from={j.spentBefore} to={j.spentAfter} />
            </dd>
            <dd className="cine-stat-note">
              <span className="cine-swap">
                <span data-from>Before this purchase</span>
                <span data-to>
                  <b>+{j.amount}</b> was {j.spentBefore}
                </span>
              </span>
            </dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd className="cine-stat-value">
              <Swap from={j.remainingBefore} to={j.remainingAfter} />
            </dd>
            <dd className="cine-stat-note">
              <span className="cine-swap">
                <span data-from>of {j.budget}</span>
                <span data-to>
                  <b>−{j.amount}</b> was {j.remainingBefore}
                </span>
              </span>
            </dd>
          </div>
        </dl>

        <div className="cine-bar">
          <span className="cine-bar-base" style={{ width: `${j.usedBefore}%` }} />
          <span
            className="cine-bar-delta"
            data-delta
            style={{ left: `${j.usedBefore}%`, width: `${j.usedAfter - j.usedBefore}%` }}
          />
        </div>
        <div className="cine-bar-legend">
          <Swap from={`${j.usedBeforeLabel} used`} to={`${j.usedAfterLabel} used`} />
          <span>{j.budget} budget</span>
        </div>

        <div className="cine-activity" data-activity>
          <span className="cine-activity-icon">
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <span className="cine-activity-text">
            <span className="cine-activity-title">Purchase approved</span>
            <span className="cine-activity-meta">
              {j.merchant} · MCC {j.mcc}
            </span>
          </span>
          <span className="cine-activity-amount">
            {j.amount}
            <span>Just now</span>
          </span>
        </div>

        <p className="cine-panel-foot">Illustrative sandbox preview — no real transaction was made.</p>
      </div>
    </div>
  )
}

/** Approval checkmark: drawn by the timeline in the film, fully drawn in the static story. */
export function ApprovalCheck() {
  return (
    <svg className="cine-check" viewBox="0 0 56 56" aria-hidden>
      <circle data-check-ring cx="28" cy="28" r="26.5" pathLength={1} />
      <path data-check-mark d="M17.5 28.8 L24.8 36 L39 21.2" pathLength={1} />
    </svg>
  )
}

/** Final chapter copy + panel, shared by the film and the static story. */
export function PayoffChapter({ resolved = false, as: Heading = 'h2' }: { resolved?: boolean; as?: 'h2' | 'h3' }) {
  return (
    <div className="cine-payoff">
      <div className="cine-payoff-head">
        <BeatCopy id="payoff" as={Heading} />
      </div>
      <JobImpactPanel resolved={resolved} />
    </div>
  )
}
