/** iOS-style status bar icons (generic shapes, not Apple assets). */
export function PhoneStatusBar({
  theme = 'dark',
}: {
  theme?: 'light' | 'dark'
}) {
  const fg = theme === 'light' ? 'text-white' : 'text-black/90'
  const icon = theme === 'light' ? 'fill-white/95' : 'fill-black/85'

  return (
    <div
      className={`phone-status-bar relative z-20 flex h-[44px] shrink-0 items-end justify-between px-[22px] pb-[6px] text-[13px] font-semibold tracking-tight ${fg}`}
    >
      <span className="w-[54px] tabular-nums">9:41</span>
      <div className="pointer-events-none absolute left-1/2 top-[10px] -translate-x-1/2" aria-hidden>
        <div className="phone-dynamic-island h-[28px] w-[108px] rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
      </div>
      <div className="flex w-[54px] items-center justify-end gap-[5px]" aria-hidden>
        <svg className="h-[10px] w-[16px]" viewBox="0 0 16 10" role="presentation">
          <rect className={icon} x="0" y="6" width="2.5" height="4" rx="0.5" />
          <rect className={icon} x="4" y="4" width="2.5" height="6" rx="0.5" />
          <rect className={icon} x="8" y="2" width="2.5" height="8" rx="0.5" />
          <rect className={icon} x="12" y="0" width="2.5" height="10" rx="0.5" opacity="0.35" />
        </svg>
        <svg className="h-[10px] w-[14px]" viewBox="0 0 14 10" role="presentation">
          <path
            className={icon}
            d="M7 2.2c1.8 0 3.4.7 4.6 1.9l1.2-1.2C11.2 1.2 9.2 0.2 7 0.2S2.8 1.2 1.2 2.9l1.2 1.2C3.6 2.9 5.2 2.2 7 2.2zm0 3.6c1 0 1.9.4 2.6 1.1l1.2-1.2C9.8 4.5 8.5 4 7 4s-2.8.5-3.8 1.7l1.2 1.2c.7-.7 1.6-1.1 2.6-1.1zm0 3.6c.5 0 1 .2 1.4.6l1.2-1.2c-.9-.9-2.1-1.4-3.6-1.4s-2.7.5-3.6 1.4l1.2 1.2c.4-.4.9-.6 1.4-.6z"
          />
        </svg>
        <svg className="h-[11px] w-[22px]" viewBox="0 0 22 11" role="presentation">
          <rect
            className={theme === 'light' ? 'stroke-white/50' : 'stroke-black/35'}
            x="0.5"
            y="0.5"
            width="18"
            height="10"
            rx="2.5"
            fill="none"
            strokeWidth="1"
          />
          <rect className={icon} x="2" y="2" width="13" height="7" rx="1.5" />
          <rect className={icon} x="19.5" y="3.5" width="2" height="4" rx="0.8" opacity="0.4" />
        </svg>
      </div>
    </div>
  )
}
