import { Link } from 'react-router-dom'
import { BudgetProgress } from '../components/BudgetProgress'
import { useDashboard } from '../context/DashboardContext'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'

const statusVariant: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  on_hold: 'warning',
  completed: 'default',
}

export function JobsPage() {
  const { data, loading } = useDashboard()
  if (loading || !data) return <Loading />

  const { jobs, workers, cards } = data

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Jobs</h2>
        <p className="mt-1 text-sm text-slate-500">
          Track material budgets and virtual cards per job site.
        </p>
      </div>

      <div className="grid gap-4">
        {jobs.map((job) => {
          const worker = workers.find((w) => w.id === job.assignedWorkerId)
          const card = cards.find((c) => c.jobId === job.id && c.status === 'active')
          return (
            <Card key={job.id} className="p-5 transition hover:shadow-md">
              <Link to={`/jobs/${job.id}`} className="block">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900">
                        {job.customerName}
                      </h3>
                      <Badge variant="brand">{job.code}</Badge>
                      <Badge variant={statusVariant[job.status] ?? 'default'}>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{job.address}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {worker?.name} · {job.trade}
                      {card && (
                        <span className="text-slate-400">
                          {' '}
                          · Card •••• {card.lastFour}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="w-full lg:max-w-xs">
                    <BudgetProgress job={job} />
                  </div>
                </div>
              </Link>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-slate-500">
      Loading jobs…
    </div>
  )
}
