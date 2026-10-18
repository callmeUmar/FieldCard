import { Check, Clock3, X } from 'lucide-react'
import { jobBudgetUsedPercent } from '../../lib/format'
import type { ActivityItem, Job, Transaction } from '../../types'

/** Presentation helpers only — they read existing state and never decide policy. */

export type Tone = 'approved' | 'review' | 'declined' | 'neutral' | 'brand'

export const TONE_CLASSES: Record<Tone, string> = {
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  review: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  declined: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/10',
  brand: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15',
}

export const TONE_DOT: Record<Tone, string> = {
  approved: 'bg-emerald-500',
  review: 'bg-amber-500',
  declined: 'bg-rose-500',
  neutral: 'bg-slate-400',
  brand: 'bg-indigo-500',
}

/** 'simulated' transactions are approved sandbox authorizations */
export function txnTone(status: Transaction['status']): Tone {
  if (status === 'approved' || status === 'simulated') return 'approved'
  if (status === 'pending') return 'review'
  return 'declined'
}

export function txnLabel(txn: Pick<Transaction, 'status'>): string {
  if (txn.status === 'pending') return 'Needs review'
  if (txn.status === 'declined') return 'Declined'
  return 'Approved'
}

export const TONE_ICON = { approved: Check, review: Clock3, declined: X } as const

/** Mirrors the thresholds BudgetProgress has always used for colouring */
export function budgetRisk(job: Job) {
  const used = jobBudgetUsedPercent(job.spentCents, job.committedCents, job.materialBudgetCents)
  if (used >= 95) return { used, tone: 'declined' as Tone, label: 'At limit', bar: 'bg-rose-500' }
  if (used >= 80) return { used, tone: 'review' as Tone, label: 'Watch', bar: 'bg-amber-500' }
  return { used, tone: 'approved' as Tone, label: 'On track', bar: 'bg-indigo-600' }
}

export type ActivityKind = 'request' | 'policy' | 'card' | 'approved' | 'declined' | 'review' | 'owner' | 'alert'

export const ACTIVITY_KINDS: { kind: ActivityKind; label: string }[] = [
  { kind: 'request', label: 'Requests' },
  { kind: 'policy', label: 'Policy checks' },
  { kind: 'card', label: 'Card issuance' },
  { kind: 'approved', label: 'Approved' },
  { kind: 'declined', label: 'Declined' },
  { kind: 'review', label: 'Pending review' },
  { kind: 'owner', label: 'Owner decisions' },
  { kind: 'alert', label: 'Budget alerts' },
]

/**
 * Classifies an existing activity event. Purchase outcomes come from the linked
 * transaction's current status when there is one, otherwise from the event title.
 */
export function activityKind(item: ActivityItem, transactions: Transaction[]): ActivityKind {
  if (item.type === 'sms') return 'request'
  if (item.type === 'card_issued') return 'card'
  if (item.type === 'budget_alert') return 'alert'
  if (item.title.startsWith('Owner ')) {
    return item.title.startsWith('Owner review') ? 'review' : 'owner'
  }
  if (item.type === 'policy_check') return 'policy'
  const txn = item.transactionId ? transactions.find((t) => t.id === item.transactionId) : undefined
  const title = item.title.toLowerCase()
  if (title.includes('declined')) return 'declined'
  if (title.includes('pending')) return txn && txn.status !== 'pending' ? 'owner' : 'review'
  if (title.includes('approved')) return 'approved'
  return txn ? (txnTone(txn.status) === 'approved' ? 'approved' : txnTone(txn.status) === 'review' ? 'review' : 'declined') : 'policy'
}

/** Newest first by timestamp — seed records are not stored in time order */
export function byNewest<T extends { createdAt?: string; timestamp?: string }>(items: T[]): T[] {
  const t = (x: T) => x.createdAt ?? x.timestamp ?? ''
  return [...items].sort((a, b) => t(b).localeCompare(t(a)))
}
