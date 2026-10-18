import { Check, Clock3, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { STACK_CARDS, type StackStatus } from './policyStackData'
import '../../styles/policy-stack.css'

/*
 * "Every purchase. Under control." — an interactive stack of sandbox decisions.
 *
 * Motion is a tiny spring integrator on requestAnimationFrame writing transforms
 * straight to the DOM (no React render per frame, no layout reads while moving).
 * The loop runs only while something is still settling.
 */

const N = STACK_CARDS.length
const FIRST_SHUFFLE_MS = 1100
const SHUFFLE_EVERY_MS = 2800
const EXIT_MS = 620

const ICONS: Record<StackStatus, typeof Check> = { approved: Check, declined: X, review: Clock3 }

type Spring = { x: number; v: number; to: number }
const spring = (x: number): Spring => ({ x, v: 0, to: x })

/** Semi-implicit Euler, fixed substeps: stable, slightly under-damped (≈4% overshoot). */
function stepSpring(s: Spring, dt: number, k = 210, c = 25) {
  s.v += (k * (s.to - s.x) - c * s.v) * dt
  s.x += s.v * dt
}
const settled = (s: Spring) => Math.abs(s.to - s.x) < 0.001 && Math.abs(s.v) < 0.001

type CardMotion = {
  y: Spring
  scale: Spring
  shade: Spring
  alpha: Spring
  /** ms timestamp when this card started leaving the top of the stack, or 0 */
  exitAt: number
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Slot pose for a depth (0 = front), blended between resting (h=0) and hovered (h=1). */
function slot(depth: number, h: number, press: number) {
  const rest = { y: depth * 13, scale: 1 - depth * 0.055, shade: depth * 0.34 }
  const fan = { y: depth === 0 ? -8 : depth * 30, scale: depth === 0 ? 1.012 : 1 - depth * 0.05, shade: depth * 0.24 }
  return {
    y: rest.y + (fan.y - rest.y) * h + (depth === 0 ? press * 3 : 0),
    scale: rest.scale + (fan.scale - rest.scale) * h - (depth === 0 ? press * 0.012 : 0),
    shade: rest.shade + (fan.shade - rest.shade) * h,
  }
}

export function PolicyStack() {
  const reduced = usePrefersReducedMotion()
  const [order, setOrder] = useState<StackStatus[]>(STACK_CARDS.map((c) => c.id))
  const front = order[0]

  const stageRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})

  // Mutable animation state (never triggers renders)
  const sim = useRef({
    order: STACK_CARDS.map((c) => c.id) as StackStatus[],
    cards: Object.fromEntries(
      STACK_CARDS.map((c, i) => {
        const p = slot(i, 0, 0)
        return [c.id, { y: spring(p.y), scale: spring(p.scale), shade: spring(p.shade), alpha: spring(1), exitAt: 0 }]
      }),
    ) as Record<StackStatus, CardMotion>,
    hover: spring(0),
    press: spring(0),
    tiltX: spring(0),
    tiltY: spring(0),
    pointer: { x: 0, y: 0 },
    raf: 0,
    last: 0,
    hovering: false,
    timer: 0,
    reduced: false,
    /** Card height, measured on resize — never read during animation frames */
    cardH: 260,
  })

  const render = useCallback(() => {
    const s = sim.current
    s.order.forEach((id, depth) => {
      const el = cardRefs.current[id]
      const m = s.cards[id]
      if (!el) return
      let y = m.y.x
      let scale = m.scale.x
      let alpha = m.alpha.x
      let rx = 0
      let z = N - depth
      if (m.exitAt) {
        // Leaving the top: lifts up and tips away while fading, above everything.
        // Lifts off fast (ease-out) and is fully transparent by 55% of the exit,
        // so it never sits legibly over the card that replaces it.
        const t = Math.min(1, (performance.now() - m.exitAt) / EXIT_MS)
        const e = 1 - Math.pow(1 - t, 3)
        y = y + (-0.7 * s.cardH - y) * e
        scale = scale + 0.035 * e
        rx = 16 * e
        alpha = 1 - easeInOut(Math.min(1, t / 0.55))
        z = N + 1
      }
      el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0) perspective(1400px) rotateX(${rx.toFixed(2)}deg) scale(${scale.toFixed(4)})`
      el.style.opacity = alpha.toFixed(3)
      el.style.zIndex = String(z)
      el.style.setProperty('--shade', m.shade.x.toFixed(3))
    })
    if (tiltRef.current) {
      tiltRef.current.style.transform = `rotateX(${s.tiltX.x.toFixed(3)}deg) rotateY(${s.tiltY.x.toFixed(3)}deg)`
    }
    if (shadowRef.current) {
      const h = s.hover.x
      shadowRef.current.style.transform = `translate3d(0, ${(h * 18).toFixed(2)}px, 0) scale(${(1 + h * 0.06).toFixed(3)}, ${(1 + h * 0.35).toFixed(3)})`
      shadowRef.current.style.opacity = (0.7 - h * 0.18).toFixed(3)
    }
  }, [])

  /** Recompute every spring target from the current order / hover / pointer. */
  const retarget = useCallback(() => {
    const s = sim.current
    const h = s.hover.to
    s.order.forEach((id, depth) => {
      const p = slot(depth, h, s.press.to)
      const m = s.cards[id]
      m.y.to = p.y
      m.scale.to = p.scale
      m.shade.to = p.shade
    })
    s.tiltX.to = s.hovering && !s.reduced ? -s.pointer.y * 7 : 0
    s.tiltY.to = s.hovering && !s.reduced ? s.pointer.x * 9 : 0
  }, [])

  const tick = useCallback(
    function step(now: number) {
      const s = sim.current
      const dt = Math.min(1 / 30, (now - (s.last || now)) / 1000)
      s.last = now
      const springs: Spring[] = [s.hover, s.press, s.tiltX, s.tiltY]
      for (const id of s.order) {
        const m = s.cards[id]
        springs.push(m.y, m.scale, m.shade, m.alpha)
        // Exit finished: the card is now invisible — tuck it into the back slot and fade it in.
        if (m.exitAt && now - m.exitAt >= EXIT_MS) {
          m.exitAt = 0
          const p = slot(N - 1, s.hover.to, 0)
          m.y.x = m.y.to = p.y + 10
          m.scale.x = m.scale.to = p.scale - 0.02
          m.shade.x = m.shade.to = p.shade
          m.alpha.x = 0
          m.alpha.v = 0
          m.alpha.to = 1
          retarget()
        }
      }
      const steps = Math.max(1, Math.round(dt / (1 / 240)))
      for (let i = 0; i < steps; i++) for (const sp of springs) stepSpring(sp, dt / steps)
      render()
      const moving = springs.some((sp) => !settled(sp)) || s.order.some((id) => s.cards[id].exitAt)
      s.raf = moving ? requestAnimationFrame(step) : 0
      if (!moving) s.last = 0
    },
    [render, retarget],
  )

  const kick = useCallback(() => {
    const s = sim.current
    if (s.reduced) {
      // Reduced motion: jump straight to the targets.
      for (const id of s.order) {
        const m = s.cards[id]
        for (const sp of [m.y, m.scale, m.shade, m.alpha]) {
          sp.x = sp.to
          sp.v = 0
        }
        m.exitAt = 0
      }
      for (const sp of [s.hover, s.press, s.tiltX, s.tiltY]) {
        sp.x = sp.to
        sp.v = 0
      }
      render()
      return
    }
    if (!s.raf) s.raf = requestAnimationFrame(tick)
  }, [render, tick])

  /** Send the front card to the back. Returns false while a shuffle is mid-flight. */
  const shuffle = useCallback(() => {
    const s = sim.current
    const leaving = s.order[0]
    const busy = s.order.some((id) => s.cards[id].exitAt && performance.now() - s.cards[id].exitAt < EXIT_MS * 0.45)
    if (busy) return false
    s.order = [...s.order.slice(1), leaving]
    if (!s.reduced) s.cards[leaving].exitAt = performance.now()
    retarget()
    setOrder(s.order)
    kick()
    return true
  }, [kick, retarget])

  const scheduleAuto = useCallback(
    function schedule(delay: number) {
      const s = sim.current
      window.clearTimeout(s.timer)
      if (!s.hovering || s.reduced) return
      s.timer = window.setTimeout(() => {
        shuffle()
        schedule(SHUFFLE_EVERY_MS)
      }, delay)
    },
    [shuffle],
  )

  const advance = useCallback(() => {
    shuffle()
    scheduleAuto(SHUFFLE_EVERY_MS) // a manual shuffle restarts the reading interval
  }, [scheduleAuto, shuffle])

  const bringToFront = useCallback(
    (id: StackStatus) => {
      const s = sim.current
      const steps = s.order.indexOf(id)
      for (let i = 0; i < steps; i++) window.setTimeout(() => shuffle(), i * (EXIT_MS * 0.5))
      scheduleAuto(SHUFFLE_EVERY_MS + steps * EXIT_MS * 0.5)
    },
    [scheduleAuto, shuffle],
  )

  // Initial paint + reduced-motion changes
  useEffect(() => {
    sim.current.reduced = reduced
    retarget()
    kick()
  }, [reduced, retarget, kick])

  // Pointer handling (mouse/pen hover; touch uses taps only)
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const s = sim.current
    let rect: DOMRect | null = null

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      rect = stage.getBoundingClientRect() // read once per hover, not per move
      s.hovering = true
      s.hover.to = s.reduced ? 0 : 1
      retarget()
      kick()
      scheduleAuto(FIRST_SHUFFLE_MS)
    }
    const onMove = (e: PointerEvent) => {
      if (!s.hovering || !rect) return
      s.pointer.x = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1))
      s.pointer.y = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1))
      retarget()
      kick()
    }
    const onLeave = () => {
      if (!s.hovering) return
      s.hovering = false
      window.clearTimeout(s.timer)
      s.hover.to = 0
      s.press.to = 0
      s.pointer.x = s.pointer.y = 0
      retarget()
      kick()
    }
    const onDown = () => {
      s.press.to = s.reduced ? 0 : 1
      retarget()
      kick()
    }
    const onUp = () => {
      s.press.to = 0
      retarget()
      kick()
    }
    const onScroll = () => {
      rect = s.hovering ? stage.getBoundingClientRect() : null
    }

    stage.addEventListener('pointerenter', onEnter)
    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerleave', onLeave)
    stage.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      stage.removeEventListener('pointerenter', onEnter)
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerleave', onLeave)
      stage.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(s.timer)
      cancelAnimationFrame(s.raf)
      s.raf = 0
    }
  }, [kick, retarget, scheduleAuto])

  // Measure the card once per size change
  useEffect(() => {
    const first = cardRefs.current[STACK_CARDS[0].id]
    if (!first) return
    const ro = new ResizeObserver(() => {
      sim.current.cardH = first.offsetHeight || 260
    })
    ro.observe(first)
    return () => ro.disconnect()
  }, [])

  // Pause the hover cycle if the tab is hidden
  useEffect(() => {
    const s = sim.current
    const onVis = () => {
      if (document.hidden) window.clearTimeout(s.timer)
      else if (s.hovering) scheduleAuto(SHUFFLE_EVERY_MS)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [scheduleAuto])

  const active = STACK_CARDS.find((c) => c.id === front)!
  const position = STACK_CARDS.findIndex((c) => c.id === front) + 1

  return (
    <section className="pstack" aria-labelledby="pstack-heading">
      <div className="pstack-inner">
        <div className="pstack-copy">
          <p className="landing-kicker">Policy in action</p>
          <h2 id="pstack-heading" className="landing-h2 mt-4">
            Every purchase. Under control.
          </h2>
          <p className="pstack-sub">
            From automatic approvals to blocked purchases and owner reviews, every decision follows your rules.
          </p>

          <ul className="pstack-legend" aria-label="Choose an example">
            {STACK_CARDS.map((card) => {
              const Icon = ICONS[card.status]
              const isActive = card.id === front
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    className="pstack-legend-item"
                    data-status={card.status}
                    aria-pressed={isActive}
                    onClick={() => bringToFront(card.id)}
                  >
                    <span className="pstack-legend-icon" aria-hidden>
                      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                    <span className="pstack-legend-text">
                      <span className="pstack-legend-label">{card.label}</span>
                      <span className="pstack-legend-summary">{card.summary}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="pstack-demo">
          <div ref={stageRef} className="pstack-stage">
            <div ref={shadowRef} className="pstack-ground" aria-hidden />
            <div ref={tiltRef} className="pstack-tilt">
              <button
                type="button"
                className="pstack-hit"
                onClick={advance}
                aria-label={`Show the next example. Showing ${position} of ${N}: ${active.merchant}, ${active.amount}, ${active.label}.`}
              >
                {STACK_CARDS.map((card) => {
                  const Icon = ICONS[card.status]
                  return (
                    <span
                      key={card.id}
                      ref={(el) => {
                        cardRefs.current[card.id] = el
                      }}
                      className="pstack-card"
                      data-status={card.status}
                      aria-hidden
                      style={{ '--shade': 0 } as CSSProperties}
                    >
                      <span className="pstack-card-accent" />
                      <span className="pstack-card-head">
                        <span className="pstack-brand">
                          <span className="pstack-mark">FC</span>
                          Fieldcard
                        </span>
                        <span className="pstack-sandbox">Sandbox</span>
                      </span>
                      <span className="pstack-merchant">{card.merchant}</span>
                      <span className="pstack-amount">{card.amount}</span>
                      <span className="pstack-job">{card.job}</span>
                      <span className="pstack-card-foot">
                        <span className="pstack-badge">
                          <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
                          {card.label}
                        </span>
                        <span className="pstack-reason">{card.reason}</span>
                      </span>
                      <span className="pstack-card-shade" />
                    </span>
                  )
                })}
              </button>
            </div>
          </div>
          <p className="pstack-hint" aria-hidden>
            <span className="pstack-hint-hover">Hover to fan the stack · click to shuffle</span>
            <span className="pstack-hint-touch">Tap the stack to shuffle</span>
            <span className="pstack-count">
              {position} / {N}
            </span>
          </p>
          <p className="sr-only" aria-live="polite">
            {active.label}: {active.merchant}, {active.amount}. {active.reason}. Sandbox example.
          </p>
        </div>
      </div>
    </section>
  )
}
