import { CreditCard, Shield } from 'lucide-react'
import { formatCurrencyPrecise, formatDateTime } from '../../lib/format'

export function VirtualCardDisplay({
  lastFour,
  spendLimitCents,
  allowedMccs,
  issuedAt,
  expiresAt,
}: {
  lastFour: string
  spendLimitCents: number
  allowedMccs: string[]
  issuedAt: string
  expiresAt: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 text-white shadow-xl shadow-slate-900/20">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
      <div className="absolute -bottom-12 -left-6 h-40 w-40 rounded-full bg-indigo-500/10" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-300">
            Sandbox virtual card
          </p>
          <Shield className="h-5 w-5 text-indigo-300" strokeWidth={1.5} />
        </div>
        <div className="mt-8 flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-slate-300" strokeWidth={1.25} />
          <p className="font-mono text-2xl tracking-[0.2em]">
            •••• •••• •••• {lastFour}
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Spend cap</p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrencyPrecise(spendLimitCents)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">allowed_mccs</p>
            <p className="mt-1 text-sm text-slate-200">{allowedMccs.join(', ')}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Issued</p>
            <p className="mt-1 text-sm text-slate-200">{formatDateTime(issuedAt)}</p>
          </div>
          <div className="sm:col-span-3 sm:grid sm:grid-cols-2 sm:gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Expires (4h)</p>
              <p className="mt-1 text-sm text-slate-200">{formatDateTime(expiresAt)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Cap basis</p>
              <p className="mt-1 text-sm text-slate-200">Approved request amount (not worker max)</p>
            </div>
          </div>
        </div>
        <p className="mt-6 text-xs text-indigo-200/90">
          Simulation only — not a live Visa authorization network.
        </p>
      </div>
    </div>
  )
}
