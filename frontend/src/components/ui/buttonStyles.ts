/** Shared button variants (also used to style links that must stay links). */

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold fc-press active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50'

export const buttonVariants = {
  primary: `${base} bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:outline-slate-900 px-4 py-2`,
  secondary: `${base} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 focus-visible:outline-slate-400 px-4 py-2`,
  ghost: `${base} text-slate-600 hover:bg-slate-100 hover:text-slate-900 px-3 py-1.5`,
  danger: `${base} bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-rose-600 px-4 py-2`,
  success: `${base} bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-emerald-600 px-4 py-2`,
}

/** Button styling for elements that must stay links (avoids <button> nested in <a>). */
export function buttonClass(variant: keyof typeof buttonVariants = 'primary') {
  return buttonVariants[variant]
}


/** Dashboard call-to-action styles shared by links and buttons */
export const ctaClass = {
  primary:
    'fc-press inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_rgba(15,23,42,0.5)] hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
  secondary:
    'fc-press inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
  onDark:
    'fc-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 shadow-[0_10px_30px_-10px_rgba(165,180,252,0.6)] hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300',
  ghostDark:
    'fc-press inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white hover:border-white/30 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300',
}
