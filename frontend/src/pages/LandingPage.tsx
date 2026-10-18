import type { MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { CinematicStory } from '../components/landing/cinematic/CinematicStory'
import { FinalCta } from '../components/landing/FinalCta'
import { Hero } from '../components/landing/Hero'
import { HowItWorks } from '../components/landing/HowItWorks'
import { PolicyStack } from '../components/landing/PolicyStack'
import { SpendingControls } from '../components/landing/SpendingControls'
import { VisibilityDemo } from '../components/landing/VisibilityDemo'
import '../styles/landing.css'
import '../styles/landing-sections.css'
// Light theme for the existing sections; loaded last, colors only (no animation changes)
import '../styles/landing-light.css'

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
      <header className="relative z-30 mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Link to="/landing" className="lx-brand flex items-center gap-2 text-[#0a2540]">
          <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-[#0a2540] text-[14px] font-semibold text-white">F</span>
          <span className="text-[16px] font-semibold tracking-[-0.01em]">Fieldcard</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          {SECTION_LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="lx-nav-link hidden md:inline-flex" onClick={(e) => scrollToSection(e, id)}>
              {label}
            </a>
          ))}
          <Link to="/dashboard" className="lx-nav-pill">
            Dashboard
          </Link>
        </nav>
      </header>

      <Hero />

      <CinematicStory />

      <PolicyStack />

      <HowItWorks />

      <SpendingControls />

      <VisibilityDemo />

      <FinalCta />

      <footer className="border-t border-[#e3e8ee] px-4 py-8 sm:px-6">
        <p className="mx-auto max-w-6xl text-[13px] text-[#697386]">© Fieldcard · DubHacks 2026 demo</p>
      </footer>
    </div>
  )
}
