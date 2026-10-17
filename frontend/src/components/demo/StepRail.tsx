const LABELS = ['SMS', 'Parse', 'Policy', 'Card', 'Purchase', 'Result']

export function StepRail({ current }: { current: number }) {
  return (
    <ol className="flex flex-wrap gap-2 sm:gap-0 sm:justify-between">
      {LABELS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={label}
            className="flex items-center gap-2 sm:flex-1 sm:flex-col sm:gap-1"
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                done
                  ? 'bg-emerald-600 text-white'
                  : active
                    ? 'bg-slate-900 text-white ring-4 ring-slate-900/10'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span
              className={`text-xs font-medium ${active ? 'text-slate-900' : 'text-slate-400'}`}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
