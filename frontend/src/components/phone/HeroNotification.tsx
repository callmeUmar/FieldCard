import { PARSED_REQUEST } from '../../demo/liveAgentScenario'
import { formatCurrencyPrecise } from '../../lib/format'

export function HeroNotification() {
  return (
    <div className="phone-notification-in mx-4 rounded-2xl border border-white/20 bg-white/12 p-3 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-xs font-bold text-white">
          FC
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[13px] font-semibold text-white">Fieldcard</p>
            <p className="text-[11px] text-white/55">now</p>
          </div>
          <p className="mt-0.5 text-[12px] leading-snug text-white/90">
            Materials request from Mike · Henderson job ·{' '}
            {formatCurrencyPrecise(PARSED_REQUEST.amountCents)} at Ferguson
          </p>
        </div>
      </div>
    </div>
  )
}
