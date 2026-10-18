import { Check } from 'lucide-react'

const LABELS = ['SMS', 'Parse', 'Policy', 'Card', 'Purchase', 'Result']

export function StepRail({ current }: { current: number }) {
  const progress = Math.min(1, Math.max(0, current / (LABELS.length - 1)))
  return (
    <div className="relative">
      {/* Track between the first and last step centres (desktop) */}
      <div
        className="pointer-events-none absolute top-4 hidden h-0.5 rounded-full bg-slate-100 sm:block"
        style={{ left: `${50 / LABELS.length}%`, right: `${50 / LABELS.length}%` }}
        aria-hidden
      >
        <div
          className="h-full origin-left rounded-full bg-emerald-500 transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <ol className="relative flex flex-wrap gap-2 sm:justify-between sm:gap-0" aria-label="Demo progress">
        {LABELS.map((label, i) => {
          const done = i < current
          const active = i === current
          return (
            <li
              key={label}
              className="flex items-center gap-2 sm:flex-1 sm:flex-col sm:gap-1.5"
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={`relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[background-color,color,box-shadow] duration-300 ${
                  done
                    ? 'bg-emerald-600 text-white'
                    : active
                      ? 'bg-slate-900 text-white ring-4 ring-indigo-500/15'
                      : 'bg-white text-slate-400 ring-1 ring-slate-200'
                }`}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.75} aria-label="Done" /> : i + 1}
              </span>
              <span
                className={`text-xs font-medium transition-colors ${
                  active ? 'text-slate-900' : done ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
