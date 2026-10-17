import type { ReactNode } from 'react'

const variants: Record<string, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10',
  warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/10',
  danger: 'bg-rose-50 text-rose-700 ring-1 ring-rose-600/10',
  brand: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600/10',
  simulated: 'bg-violet-50 text-violet-700 ring-1 ring-violet-600/15',
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
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  )
}
