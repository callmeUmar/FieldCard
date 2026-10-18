import type { ReactNode } from 'react'

const variants: Record<string, string> = {
  default: 'bg-slate-100 text-slate-700 ring-slate-500/10',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  brand: 'bg-indigo-50 text-indigo-700 ring-indigo-600/15',
  simulated: 'bg-violet-50 text-violet-700 ring-violet-600/15',
  code: 'bg-slate-900/[0.04] text-slate-700 ring-slate-900/10 font-mono tracking-wide',
}

export function Badge({
  children,
  variant = 'default',
}: {
  children: ReactNode
  variant?: keyof typeof variants
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${variants[variant]}`}
    >
      {children}
    </span>
  )
}
