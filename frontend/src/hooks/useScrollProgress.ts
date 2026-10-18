import { useEffect, useRef, type RefObject } from 'react'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * Reports how far the viewport has travelled through `ref`: 0 when the
 * element's top is `lead` viewport-heights below the viewport top (0 = at the
 * top), 1 when its bottom reaches the viewport bottom. Scroll listeners are
 * only attached while the element is near the viewport, and the value is eased
 * toward its target each frame so discrete wheel steps read as continuous
 * motion.
 *
 * `onProgress` runs inside requestAnimationFrame — write to the DOM there
 * rather than setting React state every frame.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  onProgress: (progress: number) => void,
  {
    enabled = true,
    smoothing = 0.18,
    lead = 0,
  }: { enabled?: boolean; smoothing?: number; lead?: number } = {},
) {
  const callback = useRef(onProgress)
  useEffect(() => {
    callback.current = onProgress
  })

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    let target = 0
    let current = Number.NaN
    let frame = 0

    const measure = () => {
      const rect = el.getBoundingClientRect()
      const offset = lead * window.innerHeight
      const travel = rect.height - window.innerHeight + offset
      target = travel > 0 ? clamp01((offset - rect.top) / travel) : rect.top <= 0 ? 1 : 0
    }

    const step = () => {
      frame = 0
      const delta = target - current
      // Snap on first measurement (e.g. page restored mid-section) and when close enough.
      current =
        Number.isNaN(current) || Math.abs(delta) < 0.0005 ? target : current + delta * smoothing
      callback.current(current)
      if (current !== target) frame = window.requestAnimationFrame(step)
    }

    const request = () => {
      measure()
      if (!frame) frame = window.requestAnimationFrame(step)
    }

    let listening = false
    const listen = (on: boolean) => {
      if (on === listening) return
      listening = on
      if (on) {
        window.addEventListener('scroll', request, { passive: true })
        window.addEventListener('resize', request)
      } else {
        window.removeEventListener('scroll', request)
        window.removeEventListener('resize', request)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        listen(entry.isIntersecting)
        // Measure once more on exit so progress settles exactly at 0 or 1.
        request()
      },
      { rootMargin: '25% 0px' },
    )
    observer.observe(el)

    return () => {
      observer.disconnect()
      listen(false)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [ref, enabled, smoothing, lead])
}
