import type { LucideIcon } from 'lucide-react'
import { Card } from './ui/Card'

export function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
}: {
  label: string
  value: string
  subtext?: string
  icon: LucideIcon
  trend?: { value: string; positive?: boolean }
}) {
  return (
    <Card className="animate-fade-in-up p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
          {trend && (
            <p
              className={`mt-2 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-slate-500'}`}
            >
              {trend.value}
            </p>
          )}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      </div>
    </Card>
  )
}
