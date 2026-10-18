import type { CSSProperties } from 'react'
import { formatCurrencyPrecise, jobRemainingCents } from '../lib/format'
import type { Job } from '../types'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { budgetRisk, TONE_CLASSES, TONE_DOT } from './ui/statusMeta'

const usd = formatCurrencyPrecise

/** Compact budget line: spent of budget, percent, animated bar. */
export function BudgetProgress({ job }: { job: Job }) {
  const risk = budgetRisk(job)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs text-slate-500">
        <span>
          <AnimatedNumber value={job.spentCents + job.committedCents} format={usd} className="font-medium text-slate-700" /> of{' '}
          <span className="fc-num">{usd(job.materialBudgetCents)}</span>
        </span>
        <span className="fc-num font-semibold text-slate-700">{risk.used}%</span>
      </div>
      <MeterTrack job={job} className="mt-2 h-1.5" />
    </div>
  )
}

/**
 * The signature budget view: remaining as the hero figure, spent and budget
 * beside it, a risk chip, and the meter. Optionally shows a projected purchase.
 */
export function BudgetMeter({ job, projectedCents = 0 }: { job: Job; projectedCents?: number }) {
  const risk = budgetRisk(job)
  const remaining = jobRemainingCents(job)
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="fc-kicker text-slate-400">Remaining</p>
          <AnimatedNumber
            value={remaining}
            format={usd}
            className="mt-1 block text-[1.75rem] font-semibold leading-none text-slate-900"
          />
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TONE_CLASSES[risk.tone]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[risk.tone]}`} aria-hidden />
          {risk.label} · <span className="fc-num">{risk.used}%</span>
        </span>
      </div>
      <MeterTrack job={job} projectedCents={projectedCents} className="mt-4 h-2" />
      <div className="mt-2.5 flex justify-between gap-3 text-xs text-slate-500">
        <span>
          Spent <AnimatedNumber value={job.spentCents} format={usd} className="font-medium text-slate-800" />
        </span>
        <span>
          Budget <span className="fc-num font-medium text-slate-800">{usd(job.materialBudgetCents)}</span>
        </span>
      </div>
    </div>
  )
}

function MeterTrack({ job, projectedCents = 0, className }: { job: Job; projectedCents?: number; className: string }) {
  const risk = budgetRisk(job)
  const budget = Math.max(job.materialBudgetCents, 1)
  const spent = Math.min(1, (job.spentCents + job.committedCents) / budget)
  const projected = Math.min(1, (job.spentCents + job.committedCents + projectedCents) / budget)
  return (
    <div
      className={`relative overflow-hidden rounded-full bg-slate-100 ${className}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={risk.used}
      aria-label={`${risk.used}% of ${job.code} materials budget used`}
    >
      {projectedCents > 0 && (
        <span
          className="fc-meter-fill absolute inset-0 rounded-full bg-[repeating-linear-gradient(-45deg,#fbbf24_0_4px,#fde68a_4px_8px)]"
          style={{ '--fc-fill': projected } as CSSProperties}
        />
      )}
      <span className={`fc-meter-fill absolute inset-0 rounded-full ${risk.bar}`} style={{ '--fc-fill': spent } as CSSProperties} />
    </div>
  )
}
