import {
  Activity,
  ArrowUpRight,
  Briefcase,
  CreditCard,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'

const nav: {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  badge?: 'pending'
}[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck, badge: 'pending' },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/simulator', label: 'Simulator', icon: CreditCard },
]

export function AppShell() {
  const location = useLocation()
  const { data } = useDashboard()
  const [mobileOpen, setMobileOpen] = useState(false)
  // Count from live transactions so the badge always matches the queue
  const pending = data?.transactions.filter((t) => t.status === 'pending').length ?? 0

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const linkClass = (isActive: boolean) =>
    `group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
      isActive ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white'
    }`

  return (
    <div className="flex min-h-screen bg-[var(--fc-canvas)]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[var(--fc-graphite)] text-white transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Dashboard navigation"
      >
        {/* faint indigo key light, as on the landing page */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,rgba(99,102,241,0.14),transparent_70%)]"
          aria-hidden
        />
        <div className="relative flex h-16 items-center gap-3 px-5">
          <Link to="/landing" className="flex items-center gap-3 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#8d8ffa] to-[#4f46e5] text-[11px] font-bold shadow-[0_6px_20px_-6px_rgba(99,102,241,0.8)]">
              FC
            </span>
            <span>
              <span className="block text-sm font-semibold leading-tight tracking-tight">Fieldcard</span>
              <span className="fc-kicker block text-[9.5px] text-white/40">Owner console</span>
            </span>
          </Link>
          <button
            type="button"
            className="ml-auto rounded-lg p-2 text-white/60 hover:bg-white/5 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative px-3 pt-2">
          <NavLink
            to="/live-demo"
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `fc-press flex min-h-11 items-center gap-3 rounded-xl border px-3 text-[13.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                isActive
                  ? 'border-indigo-400/50 bg-indigo-500/20 text-white'
                  : 'border-white/10 bg-white/[0.04] text-indigo-100 hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-white'
              }`
            }
          >
            <Sparkles className="h-4 w-4 text-indigo-300" strokeWidth={1.75} />
            <span className="flex-1">Live Agent Demo</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-60" />
          </NavLink>
        </div>

        <nav className="relative flex-1 space-y-0.5 p-3">
          <p className="fc-kicker px-3 pb-2 pt-3 text-[9.5px] text-white/30">Workspace</p>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => linkClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute inset-y-2.5 left-0 w-[2px] rounded-full bg-indigo-400 transition-transform duration-300 ${isActive ? 'scale-y-100' : 'scale-y-0'}`}
                    aria-hidden
                  />
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge === 'pending' && pending > 0 && (
                    <span
                      className="fc-num flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10.5px] font-bold text-slate-900"
                      aria-label={`${pending} pending`}
                    >
                      {pending}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="relative m-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
          <p className="truncate text-sm font-medium">{data?.company.name ?? 'Loading…'}</p>
          <p className="mt-0.5 text-xs text-white/45">Seattle · Owner: {data?.company.ownerName ?? '—'}</p>
          <p className="fc-kicker mt-3 flex items-center gap-1.5 text-[9.5px] text-amber-200/90">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden />
            Sandbox · no real payments
          </p>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="fc-scrim fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200/70 bg-[var(--fc-canvas)]/85 px-4 backdrop-blur-md lg:px-8">
          <button
            type="button"
            className="-ml-1 rounded-lg p-2.5 text-slate-600 hover:bg-slate-200/60 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="min-w-0 truncate text-sm text-slate-500">
            <span className="font-medium text-slate-900">{data?.company.name}</span>
            <span className="hidden sm:inline"> · Job-controlled field spend</span>
          </p>
          <div className="ml-auto flex items-center gap-3">
            <span className="fc-kicker inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] text-amber-800 ring-1 ring-inset ring-amber-600/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
              Sandbox
            </span>
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white"
              title={`${data?.company.ownerName ?? 'Owner'} · Owner`}
            >
              {data?.company.ownerName?.charAt(0) ?? 'O'}
            </span>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* Keyed by route so each page arrives with a short, reduced-motion-safe reveal */}
          <div key={location.pathname} className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
