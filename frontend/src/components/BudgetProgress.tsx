import { formatCurrency, jobBudgetUsedPercent } from '../lib/format'
import type { Job } from '../types'

export function BudgetProgress({ job }: { job: Job }) {
  const used = jobBudgetUsedPercent(
    job.spentCents,
    job.committedCents,
    job.materialBudgetCents,
  )
  const barColor =
    used >= 95 ? 'bg-rose-500' : used >= 80 ? 'bg-amber-500' : 'bg-indigo-600'

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {formatCurrency(job.spentCents + job.committedCents)} of{' '}
          {formatCurrency(job.materialBudgetCents)}
        </span>
        <span className="font-medium text-slate-700">{used}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${used}%` }}
        />
      </div>
    </div>
  )
}
