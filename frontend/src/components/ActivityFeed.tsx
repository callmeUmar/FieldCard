import {
  AlertTriangle,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react'
import { formatRelativeTime } from '../lib/format'
import type { ActivityItem, Transaction } from '../types'
import { activityKind, byNewest, TONE_CLASSES, type ActivityKind, type Tone } from './ui/statusMeta'

const KIND_STYLE: Record<ActivityKind, { icon: typeof Check; tone: Tone }> = {
  request: { icon: MessageSquare, tone: 'brand' },
  policy: { icon: ShieldCheck, tone: 'neutral' },
  card: { icon: CreditCard, tone: 'brand' },
  approved: { icon: Check, tone: 'approved' },
  declined: { icon: X, tone: 'declined' },
  review: { icon: Clock3, tone: 'review' },
  owner: { icon: UserCheck, tone: 'approved' },
  alert: { icon: AlertTriangle, tone: 'review' },
}

/**
 * Event timeline. Events linked to a purchase can open the transaction
 * inspector via `onSelectTransaction`.
 */
export function ActivityFeed({
  items,
  limit,
  transactions = [],
  onSelectTransaction,
  dense = false,
}: {
  items: ActivityItem[]
  limit?: number
  transactions?: Transaction[]
  onSelectTransaction?: (transactionId: string) => void
  dense?: boolean
}) {
  const sorted = byNewest(items)
  const list = limit ? sorted.slice(0, limit) : sorted

  return (
    <ul className="relative">
      {list.map((item, i) => {
        const kind = activityKind(item, transactions)
        const style = KIND_STYLE[kind]
        const tone: Tone = kind === 'owner' && item.title.includes('declined') ? 'declined' : style.tone
        const Icon = kind === 'owner' && item.title.includes('declined') ? X : style.icon
        const simulated = item.type === 'simulation' || item.meta?.simulated === 'true'
        const selectable = Boolean(onSelectTransaction && item.transactionId && transactions.some((t) => t.id === item.transactionId))
        const content = (
          <>
            {/* timeline spine */}
            {i < list.length - 1 && <span className="absolute left-[35px] top-11 bottom-0 w-px bg-slate-100" aria-hidden />}
            <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${TONE_CLASSES[tone]}`}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-3">
                <span className="text-[13.5px] font-semibold leading-snug text-slate-900">{item.title}</span>
                <span className="shrink-0 pt-0.5 text-[11px] text-slate-400">{formatRelativeTime(item.timestamp)}</span>
              </span>
              <span className={`mt-0.5 block text-[13px] leading-snug text-slate-500 ${dense ? 'line-clamp-1' : 'line-clamp-2'}`}>
                {item.description}
              </span>
              {simulated && (
                <span className="fc-kicker mt-1.5 inline-block rounded bg-violet-50 px-1.5 py-0.5 text-[9.5px] text-violet-700 ring-1 ring-inset ring-violet-600/15">
                  Sandbox
                </span>
              )}
            </span>
            {selectable && <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" aria-hidden />}
          </>
        )
        return (
          <li key={item.id} className="relative">
            {selectable ? (
              <button
                type="button"
                onClick={() => onSelectTransaction!(item.transactionId!)}
                className="fc-row group relative flex w-full gap-3 px-5 py-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500"
              >
                {content}
              </button>
            ) : (
              <div className="relative flex gap-3 px-5 py-3.5">{content}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
