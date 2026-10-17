import type { ButtonHTMLAttributes, ReactNode } from 'react'

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50'

const variants = {
  primary: `${base} bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:outline-slate-900 px-4 py-2`,
  secondary: `${base} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-slate-400 px-4 py-2`,
  ghost: `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900 px-3 py-1.5`,
  danger: `${base} bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-600 px-4 py-2`,
  success: `${base} bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-emerald-600 px-4 py-2`,
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  children: ReactNode
}) {
  return (
    <button type="button" className={`${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}
