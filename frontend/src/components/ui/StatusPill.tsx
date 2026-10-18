import type { Transaction } from '../../types'
import { TONE_CLASSES, TONE_ICON, txnLabel, txnTone } from './statusMeta'

/** Transaction status with icon; re-stamps when the status changes. */
export function StatusPill({ txn, size = 'md' }: { txn: Pick<Transaction, 'status' | 'isSimulated'>; size?: 'sm' | 'md' }) {
  const tone = txnTone(txn.status)
  const Icon = TONE_ICON[tone as keyof typeof TONE_ICON]
  return (
    <span
      key={txn.status}
      className={`fc-stamp inline-flex shrink-0 items-center gap-1 rounded-full font-medium ring-1 ring-inset ${TONE_CLASSES[tone]} ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.5} aria-hidden />
      {txnLabel(txn)}
    </span>
  )
}
