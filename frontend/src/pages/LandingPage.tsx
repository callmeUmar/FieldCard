import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { CinematicStory } from '../components/landing/cinematic/CinematicStory'
import { FinalCta } from '../components/landing/FinalCta'
import { HowItWorks } from '../components/landing/HowItWorks'
import { PolicyStack } from '../components/landing/PolicyStack'
import { SpendingControls } from '../components/landing/SpendingControls'
import { VisibilityDemo } from '../components/landing/VisibilityDemo'
import '../styles/landing.css'
import '../styles/landing-sections.css'

const SECTION_LINKS = [
  ['how-it-works', 'How it works'],
  ['controls', 'Controls'],
  ['visibility', 'Visibility'],
] as const

/** Smooth-scroll in JS rather than via CSS so the cinematic timeline's own scrollTo calls stay instant */
function scrollToSection(e: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id)
  if (!target) return
  e.preventDefault()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
}

export function LandingPage() {
  return (
    <div className="landing-root relative min-h-screen">
      <header className="absolute inset-x-0 top-0 z-30 mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Link to="/landing" className="lx-brand flex items-center gap-2">
          <span className="lx-brand-mark flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">
            FC
          </span>
          <span className="font-semibold tracking-tight">Fieldcard</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          {SECTION_LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="lx-nav-link hidden md:inline-flex" onClick={(e) => scrollToSection(e, id)}>
              {label}
            </a>
          ))}
          <Link to="/live-demo" className="lx-nav-link hidden sm:inline-flex">
            Live demo
          </Link>
          <Link to="/" className="lx-nav-pill">
            Open dashboard
          </Link>
        </nav>
      </header>

      <CinematicStory />

      <PolicyStack />

      <HowItWorks />

      <SpendingControls />

      <VisibilityDemo />

      <FinalCta />

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-white/40">© Fieldcard · DubHacks 2026 demo</p>
          <div className="flex gap-6 text-sm text-white/50">
            <Link to="/live-demo" className="lx-footer-link">
              Live demo
            </Link>
            <Link to="/" className="lx-footer-link">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
