import {
  AlertTriangle,
  Bot,
  CreditCard,
  MessageSquare,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { formatRelativeTime } from '../lib/format'
import type { ActivityItem } from '../types'
import { Badge } from './ui/Badge'

const iconMap: Record<ActivityItem['type'], typeof ShoppingBag> = {
  purchase: ShoppingBag,
  card_issued: CreditCard,
  policy_check: Bot,
  budget_alert: AlertTriangle,
  sms: MessageSquare,
  simulation: Sparkles,
}

export function ActivityFeed({
  items,
  limit,
  onSelect,
}: {
  items: ActivityItem[]
  limit?: number
  onSelect?: (item: ActivityItem) => void
}) {
  const list = limit ? items.slice(0, limit) : items

  return (
    <ul className="divide-y divide-slate-100">
      {list.map((item, i) => {
        const Icon = iconMap[item.type]
        const simulated = item.type === 'simulation' || item.meta?.simulated === 'true'
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect?.(item)}
              className={`flex w-full gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50/80 ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  {simulated && <Badge variant="simulated">Simulated</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-slate-500 line-clamp-2">
                  {item.description}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatRelativeTime(item.timestamp)}
                </p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
