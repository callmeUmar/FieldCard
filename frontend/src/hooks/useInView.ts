import { useEffect, useRef, useState } from 'react'

/**
 * True once the element has entered the viewport (or while it is inside it, with
 * `once: false`). One IntersectionObserver per element, no scroll listeners.
 */
export function useInView<T extends Element>({
  threshold = 0.2,
  rootMargin = '0px 0px -10% 0px',
  once = true,
}: { threshold?: number; rootMargin?: string; once?: boolean } = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) io.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, rootMargin, once])

  return [ref, inView] as const
}
