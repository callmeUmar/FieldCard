import { Nfc } from 'lucide-react'
import { formatCurrencyPrecise, formatDateTime } from '../../lib/format'

/** Sandbox card — same graphite, chip and SANDBOX language as the landing page's 3D card. */
export function VirtualCardDisplay({
  lastFour,
  spendLimitCents,
  allowedMccs,
  issuedAt,
  expiresAt,
  singleUse = true,
  capBasis = 'Approved request amount (not worker max)',
}: {
  lastFour: string
  spendLimitCents: number
  allowedMccs: string[]
  issuedAt: string
  expiresAt: string
  /** Defaults match the Live Agent Demo card */
  singleUse?: boolean
  capBasis?: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="relative overflow-hidden bg-[linear-gradient(135deg,#2b2d34_0%,#15161b_55%,#1c1b27_100%)] p-6 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06] [background:repeating-linear-gradient(0deg,#fff_0px,#fff_1px,transparent_1px,transparent_3px)]"
          aria-hidden
        />
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-400/15 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[#8d8ffa] to-[#4f46e5] text-[11px] font-bold">
                FC
              </span>
              Fieldcard
            </span>
            <span className="rounded-full border border-amber-300/70 bg-amber-300/10 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.18em] text-amber-200">
              SANDBOX
            </span>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <div className="relative h-9 w-12 overflow-hidden rounded-md bg-gradient-to-br from-[#f4e5b2] via-[#c9aa63] to-[#ecd99f] ring-1 ring-black/10" aria-hidden>
              <span className="absolute inset-x-0 top-1/3 h-px bg-black/25" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-black/25" />
              <span className="absolute inset-y-2 left-1/2 w-4 -translate-x-1/2 rounded-sm border border-black/25" />
            </div>
            <Nfc className="h-6 w-6 text-white/70" strokeWidth={1.75} aria-hidden />
          </div>

          <p className="mt-5 font-mono text-xl tracking-[0.2em] sm:text-2xl" aria-label={`Card ending ${lastFour}`}>
            <span className="text-white/75">•••• •••• •••• </span>
            <span className="font-semibold text-white">{lastFour}</span>
          </p>
          <div className="mt-4 flex items-end justify-between gap-4">
            <p className="font-mono text-[11px] font-semibold tracking-[0.16em] text-white/60">{singleUse ? 'SINGLE-USE VIRTUAL' : 'VIRTUAL · JOB CARD'}</p>
            <p className="text-right text-xs font-medium text-indigo-200/90">Simulation — not a live card</p>
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Spend cap</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
            {formatCurrencyPrecise(spendLimitCents)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">allowed_mccs</dt>
          <dd className="mt-1 font-mono text-slate-900">{allowedMccs.join(', ')}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Issued</dt>
          <dd className="mt-1 text-slate-700">{formatDateTime(issuedAt)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Expires (4h)</dt>
          <dd className="mt-1 text-slate-700">{formatDateTime(expiresAt)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Cap basis</dt>
          <dd className="mt-1 text-slate-700">{capBasis}</dd>
        </div>
      </dl>
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        Simulation only — not a live Visa authorization network.
      </p>
    </div>
  )
}
