import { ActivityFeed } from '../components/ActivityFeed'
import { useDashboard } from '../context/DashboardContext'
import { Card, CardHeader } from '../components/ui/Card'

export function ActivityPage() {
  const { data, loading } = useDashboard()
  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        Loading activity…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Activity</h2>
        <p className="mt-1 text-sm text-slate-500">
          SMS requests, card events, and purchase outcomes — refreshes every 30s.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Live-style feed" description="Newest events first" />
        <ActivityFeed items={data.activities} />
      </Card>
    </div>
  )
}
