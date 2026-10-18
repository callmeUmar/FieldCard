import { ArrowRight, MessageSquare, Shield, Sparkles, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LandingDashboardPreview } from '../components/landing/LandingDashboardPreview'
import { LandingHeroShowcase } from '../components/landing/LandingHeroShowcase'
import { ScrollToControlSection } from '../components/landing/ScrollToControlSection'
import '../styles/landing.css'

export function LandingPage() {
  return (
    <div className="landing-root min-h-screen">
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <Link to="/landing" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">
            FC
          </span>
          <span className="font-semibold tracking-tight">Fieldcard</span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            to="/live-demo"
            className="hidden text-sm font-medium text-white/70 transition hover:text-white sm:inline"
          >
            Live Demo
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
          >
            Open Dashboard
          </Link>
        </nav>
      </header>

      <section className="landing-hero-glow landing-grid-bg relative overflow-hidden px-4 pb-20 pt-8 sm:px-6 sm:pb-24 sm:pt-12">
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">
              DubHacks 2026 · Sandbox demo
            </p>
            <h1 className="mt-5 text-[2.65rem] font-semibold leading-[1.02] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.5rem]">
              Field spend,
              <br />
              <span className="bg-gradient-to-r from-white via-indigo-100 to-[#a5b4fc] bg-clip-text text-transparent">
                orchestrated by text.
              </span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-white/65">
              Workers request materials by text. Fieldcard handles spending rules,
              approvals, virtual cards, and live job costing — without another app to
              install.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/live-demo"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400"
              >
                Watch Live Demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Open Dashboard
              </Link>
            </div>
            <p className="mt-6 text-xs text-white/40">
              Simulated SMS and sandbox cards in demo mode — not live Visa authorization.
            </p>
          </div>
          <div className="relative flex justify-center lg:justify-end lg:pr-4">
            <div
              className="pointer-events-none absolute -inset-12 rounded-full bg-indigo-500/15 blur-3xl"
              aria-hidden
            />
            <LandingHeroShowcase />
          </div>
        </div>
      </section>

      <ScrollToControlSection />

      <section className="border-t border-white/5 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold text-white sm:text-3xl">
            How it works
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: MessageSquare,
                title: 'Text',
                body: 'Mike texts what he needs, where, and for which job. No new app.',
              },
              {
                icon: Shield,
                title: 'Approve',
                body: 'Policy checks budget, worker limits, and MCC rules — then issues a sandbox card.',
              },
              {
                icon: Wallet,
                title: 'Track',
                body: 'Dana sees spend, approvals, and activity on every job in real time.',
              },
            ].map((item) => (
              <div key={item.title} className="landing-glass rounded-2xl p-6">
                <item.icon className="h-6 w-6 text-indigo-300" strokeWidth={1.5} />
                <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Built for the field
            </h2>
            <p className="mt-4 text-white/60 leading-relaxed">
              Plumbers and HVAC techs will not stop for expense software. Fieldcard meets
              them in SMS, enforces your rules automatically, and keeps job costing accurate
              while they stay on the tools.
            </p>
          </div>
          <div className="landing-glass rounded-2xl p-6">
            <ul className="space-y-4 text-sm text-white/70">
              <li className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                Single-use virtual cards locked to amount and merchant category (MCC)
              </li>
              <li className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                4-hour expiry on sandbox cards — tight control per request
              </li>
              <li className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                Owner approvals when spend crosses your threshold
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Control every dollar
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Job budgets', 'HEN-1042 · $790 remaining'],
              ['Worker limits', 'Mike · $300 per purchase'],
              ['Merchant rules', 'allowed_mccs on each card'],
              ['Auto-approve', 'Under owner threshold'],
            ].map(([title, sub]) => (
              <div key={title} className="landing-glass rounded-xl p-4">
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-1 text-xs text-white/50">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Complete visibility
          </h2>
          <p className="mt-3 max-w-2xl text-white/55">
            The same dashboard your team uses in the demo — budgets, approvals, and a live
            activity feed.
          </p>
          <div className="mt-10">
            <LandingDashboardPreview />
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Stop chasing receipts.
            <br />
            Start controlling spend.
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              to="/live-demo"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-400"
            >
              Watch Demo
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/5"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-white/40">© Fieldcard · DubHacks 2026 demo</p>
          <div className="flex gap-6 text-sm text-white/50">
            <Link to="/live-demo" className="hover:text-white">Live Demo</Link>
            <Link to="/" className="hover:text-white">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
