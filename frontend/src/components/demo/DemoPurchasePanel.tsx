import { Check, Loader2, Shield } from 'lucide-react'
import { ALLOWED_PURCHASE, BLOCKED_PURCHASE } from '../../demo/liveAgentScenario'
import { formatUsd } from '../../lib/policyEngine'
import { Card } from '../ui/Card'

export function DemoPurchasePanel({
  onPurchase,
  busy,
  flash,
}: {
  onPurchase: (variant: 'allowed' | 'blocked') => void
  busy: boolean
  flash: 'approved' | 'declined' | null
}) {
  return (
    <Card className={`overflow-hidden p-6 transition-shadow duration-500 ${flash === 'approved' ? 'purchase-glow-approve' : ''} ${flash === 'declined' ? 'purchase-glow-decline' : ''}`}>
      <h3 className="text-sm font-semibold text-slate-900">Simulate card swipe</h3>
      <p className="mt-1 text-sm text-slate-500">
        Decisions come from <code className="text-xs">allowed_mccs</code> on the issued
        card — simulated authorization only.
      </p>

      {flash === 'approved' && (
        <div className="purchase-result-in mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white">
            <Check className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div>
            <p className="font-semibold text-emerald-900">Purchase approved</p>
            <p className="text-sm text-emerald-800">Job budget updated · activity recorded</p>
          </div>
        </div>
      )}

      {flash === 'declined' && (
        <div className="purchase-result-in mt-4 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-600 text-white purchase-pulse-once">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-rose-900">Purchase blocked</p>
            <p className="text-sm text-rose-800">
              MCC {BLOCKED_PURCHASE.mcc} is not in allowed_mccs [5074]. Budget unchanged.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onPurchase('allowed')}
          className="group rounded-xl border-2 border-emerald-200/80 bg-gradient-to-b from-emerald-50/80 to-white p-4 text-left transition hover:border-emerald-400 hover:shadow-md disabled:opacity-50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Expected · Approved
          </p>
          <p className="mt-2 font-semibold text-slate-900">{ALLOWED_PURCHASE.merchant}</p>
          <p className="mt-1 text-sm text-slate-600">MCC {ALLOWED_PURCHASE.mcc}</p>
          <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">
            {formatUsd(ALLOWED_PURCHASE.amountCents)}
          </p>
          {busy && (
            <Loader2 className="mt-2 h-4 w-4 animate-spin text-emerald-600" />
          )}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onPurchase('blocked')}
          className="group rounded-xl border-2 border-rose-200/80 bg-gradient-to-b from-rose-50/60 to-white p-4 text-left transition hover:border-rose-400 hover:shadow-md disabled:opacity-50"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Expected · Declined
          </p>
          <p className="mt-2 font-semibold text-slate-900">Home Depot</p>
          <p className="mt-1 text-sm text-slate-600">MCC {BLOCKED_PURCHASE.mcc}</p>
          <p className="mt-2 text-lg font-bold tabular-nums text-slate-900">
            {formatUsd(BLOCKED_PURCHASE.amountCents)}
          </p>
        </button>
      </div>
    </Card>
  )
}
