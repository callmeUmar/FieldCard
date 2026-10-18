import type { ReactNode } from 'react'

/** Page title block: mono kicker, strong title, one line of context, actions. */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="fc-enter flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="fc-kicker text-indigo-600/80">{kicker}</p>
        <h2 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-slate-900 sm:text-[2rem]">
          {title}
        </h2>
        {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
