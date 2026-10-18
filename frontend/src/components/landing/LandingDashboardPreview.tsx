import { initialSnapshot } from '../../data/mockData'
import { BudgetProgress } from '../BudgetProgress'
import { MetricCard } from '../MetricCard'
import { DollarSign, Briefcase } from 'lucide-react'
import { formatCurrency } from '../../lib/format'

/** Static preview using seed data — not live dashboard state */
export function LandingDashboardPreview() {
  const job = initialSnapshot.jobs[0]
  const metrics = initialSnapshot.metrics

  return (
    <div className="landing-glass rounded-2xl p-4 sm:p-6 shadow-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <p className="text-sm font-semibold text-white">Owner dashboard</p>
          <p className="text-xs text-white/50">Ballard Plumbing & Heat · Demo preview</p>
        </div>
        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
          Demo Mode
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <MetricCard
            label="Material spend"
            value={formatCurrency(metrics.totalMaterialSpendCents)}
            subtext="Across active jobs"
            icon={DollarSign}
          />
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <MetricCard
            label="Active jobs"
            value={String(metrics.activeJobs)}
            icon={Briefcase}
          />
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">{job.customerName}</p>
        <p className="text-xs text-slate-500">{job.code}</p>
        <div className="mt-3">
          <BudgetProgress job={job} />
        </div>
      </div>
    </div>
  )
}
