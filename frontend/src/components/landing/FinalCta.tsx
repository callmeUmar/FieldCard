import { ArrowRight, LayoutDashboard } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useInView } from '../../hooks/useInView'

/*
 * Closing call to action. The light behind the headline drifts toward the
 * pointer on fine-pointer devices (one rAF-throttled listener, scoped to the
 * section); on touch and with reduced motion it simply rests in place.
 */
export function FinalCta() {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.35 })
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const section = ref.current
    const glow = glowRef.current
    if (!section || !glow) return
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let x = 0
    let y = 0

    const onMove = (e: PointerEvent) => {
      if (!fine.matches || reduce.matches) return
      const r = section.getBoundingClientRect()
      x = (e.clientX - r.left) / r.width - 0.5
      y = (e.clientY - r.top) / r.height - 0.5
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0
          glow.style.transform = `translate3d(${x * 28}%, ${y * 22}%, 0)`
        })
      }
    }
    const onLeave = () => {
      cancelAnimationFrame(raf)
      raf = 0
      glow.style.transform = ''
    }
    section.addEventListener('pointermove', onMove)
    section.addEventListener('pointerleave', onLeave)
    return () => {
      section.removeEventListener('pointermove', onMove)
      section.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [ref])

  return (
    <section ref={ref} className="lx-cta" data-inview={inView} aria-labelledby="cta-heading">
      <div className="lx-cta-light" aria-hidden>
        <div ref={glowRef} className="lx-cta-glow" />
      </div>
      <div className="lx-cta-inner">
        <h2 id="cta-heading" className="lx-cta-title">
          <span className="lx-cta-line">
            <span>Your team buys.</span>
          </span>
          <span className="lx-cta-line lx-cta-line-2">
            <span>You stay in control.</span>
          </span>
        </h2>
        <p className="lx-cta-lede lx-reveal">
          Follow one request from a text message to a coded purchase in the 90-second interactive demo.
        </p>
        <div className="lx-cta-actions lx-reveal">
          <Link to="/live-demo" className="lx-btn-primary">
            Try the interactive demo
            <ArrowRight className="lx-btn-arrow" aria-hidden />
          </Link>
          <Link to="/" className="lx-btn-secondary">
            <LayoutDashboard aria-hidden />
            Open dashboard
          </Link>
        </div>
        <p className="lx-cta-note lx-reveal">Sandbox simulation · no real payments</p>
      </div>
    </section>
  )
}
