import { useLayoutEffect, useRef } from 'react'

/**
 * Renders a formatted number that glides to new values when real state changes.
 * The first render is static; text is written directly (no React render per
 * frame) and always lands on the exact formatted value.
 */
export function AnimatedNumber({
  value,
  format,
  className = '',
  durationMs = 700,
}: {
  value: number
  format: (n: number) => string
  className?: string
  durationMs?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const shown = useRef<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const from = shown.current
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (from === null || from === value || reduce) {
      shown.current = value
      el.textContent = format(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = t === 1 ? value : Math.round(from + (value - from) * eased)
      shown.current = v
      el.textContent = format(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      // Never leave an interrupted tween showing a stale figure
      shown.current = value
      el.textContent = format(value)
    }
  }, [value, format, durationMs])

  return <span ref={ref} className={`fc-num ${className}`} />
}
