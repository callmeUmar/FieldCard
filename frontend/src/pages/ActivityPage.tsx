import { useCallback, useState } from 'react'
import { ActivityFeed } from '../components/ActivityFeed'
import { TransactionInspector } from '../components/TransactionInspector'
import { Card } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'
import { PageLoading } from '../components/ui/PageLoading'
import { ACTIVITY_KINDS, activityKind, type ActivityKind } from '../components/ui/statusMeta'
import { useDashboard } from '../context/DashboardContext'

export function ActivityPage() {
  const { data, loading } = useDashboard()
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const close = useCallback(() => setSelected(null), [])
  if (loading || !data) return <PageLoading label="Loading activity…" />

  const kinds = data.activities.map((a) => activityKind(a, data.transactions))
  const counts = new Map<ActivityKind, number>()
  kinds.forEach((k) => counts.set(k, (counts.get(k) ?? 0) + 1))
  const items = filter === 'all' ? data.activities : data.activities.filter((_, i) => kinds[i] === filter)
  const available = ACTIVITY_KINDS.filter((k) => counts.has(k.kind))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        kicker="Activity"
        title="Event timeline"
        description="Every request, policy check, card and decision, newest first. Purchase events open the full transaction."
      />

      <div className="fc-enter fc-enter-1 -mx-1 flex flex-wrap gap-2 px-1" role="group" aria-label="Filter events">
        {[{ kind: 'all' as const, label: 'All events' }, ...available].map((k) => {
          const active = filter === k.kind
          const n = k.kind === 'all' ? data.activities.length : counts.get(k.kind)
          return (
            <button
              key={k.kind}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(k.kind)}
              className={`fc-press inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {k.label}
              <span className={`fc-num text-xs ${active ? 'text-white/60' : 'text-slate-400'}`}>{n}</span>
            </button>
          )
        })}
      </div>

      <Card className="fc-enter fc-enter-2 overflow-hidden">
        {items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-500">No events of this kind yet.</p>
        ) : (
          <ActivityFeed key={filter} items={items} transactions={data.transactions} onSelectTransaction={setSelected} />
        )}
      </Card>

      <TransactionInspector txnId={selected} onClose={close} />
    </div>
  )
}
