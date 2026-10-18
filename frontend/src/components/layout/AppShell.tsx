import {
  Activity,
  Briefcase,
  CreditCard,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDashboard } from '../../context/DashboardContext'
import { Badge } from '../ui/Badge'

const nav: {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
  highlight?: boolean
  badge?: 'pending'
}[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/live-demo', label: 'Live Agent Demo', icon: Sparkles, highlight: true },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck, badge: 'pending' },
  { to: '/activity', label: 'Activity', icon: Activity },
  { to: '/simulator', label: 'Simulator', icon: CreditCard },
]

export function AppShell() {
  const location = useLocation()
  const { data } = useDashboard()
  const [mobileOpen, setMobileOpen] = useState(false)
  const pending = data?.metrics.pendingApprovals ?? 0

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-800/50 bg-[#0f172a] text-white transition-transform lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-bold text-sm">
            FC
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Fieldcard</p>
            <p className="text-xs text-slate-400">Owner dashboard</p>
          </div>
          <button
            type="button"
            className="ml-auto lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-indigo-400'
                    : item.highlight
                      ? 'text-indigo-200 hover:bg-indigo-500/20 hover:text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} />
              <span className="flex-1">{item.label}</span>
              {item.badge === 'pending' && pending > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-slate-900">
                  {pending}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">
            {data?.company.name ?? 'Loading…'}
          </p>
          <p className="mt-1 text-xs text-slate-400">Seattle · Demo tenant</p>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden"
          aria-label="Close overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200/80 bg-white/80 px-4 backdrop-blur-md lg:px-8">
          <button
            type="button"
            className="rounded-lg p-2.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-semibold text-slate-900">
                {data?.company.name}
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Job-controlled field spend · Sandbox cards
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="brand">
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                Demo Mode
              </Badge>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">
                  {data?.company.ownerName ?? 'Owner'}
                </p>
                <p className="text-xs text-slate-500">Owner</p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-slate-800 text-xs font-semibold text-white">
                {data?.company.ownerName?.charAt(0) ?? 'O'}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          {/* Keyed by route so each page arrives with a short, reduced-motion-safe reveal */}
          <div key={location.pathname} className="animate-fade-in-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
