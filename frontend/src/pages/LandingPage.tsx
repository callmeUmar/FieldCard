import { ArrowRight, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CinematicStory } from '../components/landing/cinematic/CinematicStory'
import { LandingDashboardPreview } from '../components/landing/LandingDashboardPreview'
import { PolicyStack } from '../components/landing/PolicyStack'
import '../styles/landing.css'

export function LandingPage() {
  return (
    <div className="landing-root relative min-h-screen">
      <header className="absolute inset-x-0 top-0 z-30 mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
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
            Live demo
          </Link>
          <Link
            to="/"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
          >
            Open dashboard
          </Link>
        </nav>
      </header>

      <CinematicStory />

      <PolicyStack />

      <section className="px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
        <div className="mx-auto max-w-6xl">
          <p className="landing-kicker">How it works</p>
          <h2 className="landing-h2 mt-4">Three steps. No new app.</h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            {[
              {
                title: 'Text',
                body: 'Mike texts what he needs, where, and for which job. No new app.',
              },
              {
                title: 'Approve',
                body: 'Policy checks budget, worker limits, and MCC rules — then issues a sandbox card.',
              },
              {
                title: 'Track',
                body: 'Dana sees spend, approvals, and activity on every job in real time.',
              },
            ].map((item, i) => (
              <li key={item.title} className="border-t border-white/10 pt-6">
                <p className="font-mono text-xs font-semibold tracking-[0.2em] text-white/40">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-white">{item.title}</h3>
                <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-white/55">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20">
          <div>
            <p className="landing-kicker">Built for the field</p>
            <h2 className="landing-h2 mt-4">Controls that work at the counter.</h2>
            <p className="mt-5 max-w-md leading-relaxed text-white/60">
              Plumbers and HVAC techs will not stop for expense software. Fieldcard meets
              them in SMS, enforces your rules automatically, and keeps job costing accurate
              while they stay on the tools.
            </p>
          </div>
          <dl className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {[
              ['Single-use virtual cards', 'Locked to the approved amount and merchant category (MCC)'],
              ['4-hour expiry', 'Sandbox cards close themselves — tight control per request'],
              ['Job budgets', 'Every card and purchase is tied to a job code'],
              ['Worker limits', 'Mike · $300 per purchase'],
              ['Merchant rules', 'allowed_mccs enforced on each card'],
              ['Owner approvals', 'Auto-approve under your threshold, review above it'],
            ].map(([title, sub]) => (
              <div key={title} className="flex gap-4 py-4">
                <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2.25} aria-hidden />
                <div className="sm:flex sm:w-full sm:items-baseline sm:justify-between sm:gap-6">
                  <dt className="font-medium text-white sm:whitespace-nowrap">{title}</dt>
                  <dd className="mt-1 text-sm text-white/50 sm:mt-0 sm:text-right">{sub}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="landing-kicker">The owner dashboard</p>
          <h2 className="landing-h2 mt-4">Complete visibility.</h2>
          <p className="mt-4 max-w-2xl leading-relaxed text-white/55">
            The same dashboard your team uses in the demo — budgets, approvals, and a live
            activity feed.
          </p>
          <div className="mt-10">
            <LandingDashboardPreview />
          </div>
        </div>
      </section>

      <section className="px-4 py-28 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="landing-h2">
            Stop chasing receipts.
            <br />
            <span className="text-white/55">Start controlling spend.</span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/live-demo" className="cine-cta-button">
              Try the interactive demo
              <ArrowRight className="cine-cta-arrow h-4 w-4" />
            </Link>
            <Link
              to="/"
              className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-6 text-sm font-semibold text-white transition hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
            >
              Open dashboard
            </Link>
          </div>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
            Sandbox simulation · no real payments
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10 px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-white/40">© Fieldcard · DubHacks 2026 demo</p>
          <div className="flex gap-6 text-sm text-white/50">
            <Link to="/live-demo" className="hover:text-white">Live demo</Link>
            <Link to="/" className="hover:text-white">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
