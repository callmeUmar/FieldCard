/** Formatting and labels for the dashboard tables. Pure functions. */

export type BadgeTone = 'issued' | 'declined' | 'flagged' | 'neutral'
export interface Badge {
  label: string
  tone: BadgeTone
}

export const usd = (n: number | null | undefined, digits = 2) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)

export const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

export const usedPercent = (spent: number, budget: number) => (budget > 0 ? (spent / budget) * 100 : 0)

/** Activity rows store a message, not an amount; the first dollar figure in it is the amount. */
export function amountFromMessage(message: string): number | null {
  const m = message.match(/\$([\d,]+(?:\.\d{1,2})?)/)
  return m ? Number(m[1].replace(/,/g, '')) : null
}

const KIND_LABELS: Record<string, string> = {
  request: 'Card requested',
  card_issued: 'Card issued',
  card_terminated: 'Card cancelled',
  approval_requested: 'Owner asked',
  approval_decided: 'Owner decided',
  purchase_approved: 'Purchase',
  purchase_declined: 'Purchase',
  receipt: 'Receipt checked',
  demo: 'Demo phone',
}

/** Event title and status badge for one activity row. */
export function describeActivity(kind: string, message: string): { event: string; badge: Badge } {
  const event = KIND_LABELS[kind] ?? kind.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
  const lower = message.toLowerCase()
  const approved: Badge = { label: 'Approved', tone: 'issued' }
  const declined: Badge = { label: 'Declined', tone: 'declined' }
  const awaiting: Badge = { label: 'Awaiting owner', tone: 'flagged' }
  switch (kind) {
    case 'request':
      return { event, badge: lower.includes('(waiting_for_owner)') ? awaiting : lower.includes('(denied)') ? declined : approved }
    case 'card_issued':
      return { event, badge: { label: 'Issued', tone: 'issued' } }
    case 'approval_requested':
      return { event, badge: awaiting }
    case 'approval_decided':
      return { event, badge: /denied|declined/.test(lower) ? declined : approved }
    case 'purchase_approved':
      return { event, badge: approved }
    case 'purchase_declined':
      return { event, badge: declined }
    case 'receipt':
      return { event, badge: lower.includes('flagged') ? { label: 'Flagged', tone: 'flagged' } : { label: 'Matched', tone: 'neutral' } }
    case 'card_terminated':
      return { event, badge: { label: 'Cancelled', tone: 'neutral' } }
    default:
      return { event, badge: { label: 'Logged', tone: 'neutral' } }
  }
}

/** Receipt flags arrive as strings or {item, why}. */
export function flagText(flag: unknown): string {
  if (flag && typeof flag === 'object' && 'item' in flag) {
    const f = flag as { item: unknown; why?: unknown }
    return f.why ? `${String(f.item)}: ${String(f.why)}` : String(f.item)
  }
  return String(flag)
}
