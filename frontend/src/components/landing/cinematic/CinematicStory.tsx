import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AMOUNT, DECISION_META } from './story'
import { StaticStory } from './StaticStory'
import { ApprovalCheck, BeatCopy, HeroCopy, PayoffChapter } from './StoryCopy'
import '../../../styles/cinematic.css'

// three.js, React Three Fiber and GSAP live in this chunk; it is only fetched
// for visitors who get the cinematic version.
const CinematicStage = lazy(() => import('./CinematicStage'))

function supportsWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

function cinematicAllowed() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches && supportsWebGL2()
}

/** Falls back to the static story if the 3D chunk fails to load or WebGL dies. */
class StageBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

function Beat({ id }: { id: 'request' | 'policy' | 'card' | 'limits' }) {
  return (
    <div className="cine-layer cine-layer--beat">
      <div className="cine-container">
        <div className="cine-beat" data-beat={id}>
          <BeatCopy id={id} />
        </div>
      </div>
    </div>
  )
}

export function CinematicStory() {
  const [mode, setMode] = useState<'cinematic' | 'static'>(() =>
    cinematicAllowed() ? 'cinematic' : 'static',
  )
  const [ready, setReady] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const onReady = useCallback(() => setReady(true), [])
  const onFail = useCallback(() => setMode('static'), [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setMode(cinematicAllowed() ? 'cinematic' : 'static')
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (mode === 'static') return <StaticStory />

  return (
    <section ref={sectionRef} className="cine" aria-label="How a text message becomes a controlled purchase">
      <div className="cine-stage">
        <div className="cine-backdrop" aria-hidden />
        <div className="cine-glow" data-glow aria-hidden />
        <div className="cine-canvas" data-ready={ready || undefined} aria-hidden>
          <StageBoundary onError={onFail}>
            <Suspense fallback={null}>
              <CinematicStage sectionRef={sectionRef} overlayRef={overlayRef} onReady={onReady} />
            </Suspense>
          </StageBoundary>
        </div>
        <div className="cine-vignette" aria-hidden />

        <div ref={overlayRef} className="cine-overlay">
          <div className="cine-layer cine-layer--hero">
            <div className="cine-container">
              <HeroCopy beat />
            </div>
          </div>

          <Beat id="request" />
          <Beat id="policy" />
          <Beat id="card" />
          <Beat id="limits" />

          <div className="cine-layer cine-layer--top">
            <div className="cine-approve" data-beat="approve">
              <p data-part className="cine-kicker cine-kicker--center">
                05 · Decision
              </p>
              <ApprovalCheck />
              <h2 className="cine-approve-word">
                <span data-word>Approved</span>
              </h2>
              <p className="cine-approve-amount" data-amount>
                {AMOUNT}
              </p>
              <span data-line className="cine-approve-line" aria-hidden />
              <p data-part className="cine-approve-meta">
                {DECISION_META}
              </p>
            </div>
          </div>

          <div className="cine-layer cine-layer--payoff">
            <div className="cine-container" data-beat="payoff">
              <PayoffChapter />
            </div>
          </div>

          <div className="cine-cue" data-beat="cue" aria-hidden>
            <span>Scroll</span>
          </div>

          <div className="cine-chrome" aria-hidden>
            <span className="cine-progress">
              <span data-progress />
            </span>
            <span className="cine-sandbox">
              Sandbox simulation<span className="cine-sandbox-extra"> · not a live card</span>
            </span>
          </div>
        </div>

        <div className="cine-loading" data-hidden={ready || undefined} aria-hidden>
          <span className="cine-loading-line" />
          Loading scene
        </div>
      </div>
    </section>
  )
}
