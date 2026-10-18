import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { NavyCard } from '../components/brand/NavyCard'
import { ThreadMotif } from '../components/brand/ThreadMotif'
import { amountFromMessage, clockTime, describeActivity, flagText, usd, usedPercent, type Badge } from '../dashboard/format'
import { DEMO_AMOUNT_USD, useDashboardData, type DashboardData } from '../dashboard/useDashboardData'
import type { JobDetailResponse } from '../types/contracts'

const SECTIONS = [
  ['overview', 'Overview'],
  ['jobs', 'Jobs'],
  ['approvals', 'Approvals'],
  ['activity', 'Activity'],
] as const
type SectionId = (typeof SECTIONS)[number][0]
const STATE_LABEL = { active: 'Active', used: 'Used', expired: 'Expired', terminated: 'Cancelled' } as const

/** Which section is in the reading band of the viewport */
function useActiveSection(ready: boolean): SectionId {
  const [active, setActive] = useState<SectionId>('overview')
  useEffect(() => {
    const visible = new Map<string, boolean>()
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => visible.set(e.target.id, e.isIntersecting))
        const first = SECTIONS.find(([id]) => visible.get(id))
        if (first) setActive(first[0])
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    SECTIONS.forEach(([id]) => {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [ready])
  return active
}

function BadgeView({ badge }: { badge: Badge }) {
  return <span className={`fc-badge fc-badge--${badge.tone}`}>{badge.label}</span>
}

function StatusDot({ status }: { status: 'live' | 'offline' | 'checking' }) {
  const live = status === 'live'
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-[#697386]" role="status">
      <span className={`h-2 w-2 rounded-full ${live ? 'bg-[#12b5a5]' : 'bg-[#a3acb9]'}`} aria-hidden />
      <span className={live ? 'font-medium text-[#0b6e63]' : ''}>{live ? 'Live' : status === 'checking' ? 'Connecting' : 'Offline'}</span>
    </span>
  )
}

function Logo() {
  return (
    <Link to="/landing" className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-[#0a2540]">
      <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#0a2540] text-[13px] font-semibold text-white">F</span>
      Fieldcard
    </Link>
  )
}

function Nav({ active, status }: { active: SectionId; status: 'live' | 'offline' | 'checking' }) {
  const link = (id: SectionId, label: string) => (
    <a
      key={id}
      href={`#${id}`}
      aria-current={active === id ? 'true' : undefined}
      className={`rounded-[6px] px-2.5 py-1.5 text-[14px] ${
        active === id ? 'bg-[#f0f0fe] font-medium text-[#5b5bf0]' : 'text-[#425466] hover:text-[#0a2540]'
      }`}
    >
      {label}
    </a>
  )
  return (
    <>
      {/* Phones: top bar */}
      <header className="sticky top-0 z-20 border-b border-[#e3e8ee] bg-white lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
          <StatusDot status={status} />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Sections">
          {SECTIONS.map(([id, label]) => link(id, label))}
        </nav>
      </header>
      {/* Desktop: narrow sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[208px] shrink-0 flex-col border-r border-[#e3e8ee] bg-white px-4 py-6 lg:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-0.5" aria-label="Sections">
          {SECTIONS.map(([id, label]) => link(id, label))}
        </nav>
        <div className="mt-auto px-2.5">
          <StatusDot status={status} />
        </div>
      </aside>
    </>
  )
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={`${id}-title`} className="mb-4 text-[20px] font-semibold tracking-[-0.02em] text-[#0a2540]">
      {children}
    </h2>
  )
}

function Overview({ data, buyAt }: { data: DashboardData; buyAt: (m: 'Ferguson' | 'Home Depot') => Promise<string> }) {
  const o = data.overview
  const card = o.latest_card
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const buy = async (merchant: 'Ferguson' | 'Home Depot') => {
    setBusy(true)
    setResult(`Buying $${DEMO_AMOUNT_USD} at ${merchant}…`)
    setResult(await buyAt(merchant))
    setBusy(false)
  }
  const rows: [string, string][] = [
    ['Spent on materials', usd(o.spent_usd)],
    ['Cards issued today', String(o.cards_issued_today)],
    ['Blocked at checkout', String(o.blocked_today)],
  ]
  return (
    <section id="overview" aria-labelledby="overview-title" className="relative scroll-mt-28 lg:scroll-mt-8">
      {/* Signature lines, faint, top-right behind the overview only; panels are white so they never cross data */}
      <ThreadMotif className="pointer-events-none absolute -right-4 -top-14 h-[96px] w-[62%] sm:-right-10 sm:w-[560px]" opacity={0.45} />
      <div className="relative">
        <SectionTitle id="overview">Overview</SectionTitle>
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
          <dl className="fc-panel self-start">
            {rows.map(([label, value], i) => (
              <div key={label} className={`flex items-baseline justify-between px-5 py-4 ${i ? 'border-t border-[#e3e8ee]' : ''}`}>
                <dt className="text-[14px] text-[#697386]">{label}</dt>
                <dd className="text-[22px] font-semibold tracking-[-0.02em] text-[#0a2540]">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <p className="mb-2 text-[13px] font-medium text-[#697386]">Latest card</p>
            {card ? (
              <NavyCard
                last4={card.last4}
                lines={[
                  `${card.merchant ?? 'Merchant'} · ${card.job_name ?? 'Job'}`,
                  `Up to ${usd(card.amount_cap_usd, 0)} · ${card.state === 'active' ? `${card.hours_left}h left` : STATE_LABEL[card.state]}`,
                ]}
                tag="Single use"
                label={`Latest card ending ${card.last4}, ${card.merchant ?? ''}, ${card.job_name ?? ''}, up to ${usd(card.amount_cap_usd)}`}
              />
            ) : (
              <div className="fc-panel flex aspect-[1.586] max-w-[340px] items-center justify-center text-[13px] text-[#697386]">
                No cards issued yet
              </div>
            )}
          </div>
        </div>

        <div className="fc-panel mt-5 flex flex-wrap items-center gap-3 px-5 py-4">
          <p className="mr-2 text-[14px] font-medium text-[#0a2540]">Demo</p>
          <button type="button" className="fc-btn" disabled={busy} onClick={() => void buy('Ferguson')}>
            Buy at Ferguson
          </button>
          <button type="button" className="fc-btn fc-btn--outline" disabled={busy} onClick={() => void buy('Home Depot')}>
            Buy at Home Depot
          </button>
          <p className="min-w-0 basis-full text-[13px] text-[#697386] sm:basis-auto sm:flex-1" aria-live="polite">
            {result || `Mike pays $${DEMO_AMOUNT_USD} with his active card.`}
          </p>
        </div>
      </div>
    </section>
  )
}

function JobPurchases({ detail }: { detail: JobDetailResponse | null | undefined }) {
  if (detail === undefined) return <p className="text-[13px] text-[#697386]">Loading…</p>
  if (detail === null) return <p className="text-[13px] text-[#697386]">Couldn’t load this job.</p>
  const flags = detail.receipts.flatMap((r) => (r.flags ?? []).map((f) => ({ store: r.store, text: flagText(f) })))
  return (
    <div className="space-y-3">
      {detail.transactions.length === 0 ? (
        <p className="text-[13px] text-[#697386]">No purchases yet.</p>
      ) : (
        <table className="fc-table">
          <thead>
            <tr>
              <th>Merchant</th>
              <th className="num">Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {detail.transactions.map((t) => (
              <tr key={t._id}>
                <td>{t.merchant_name}</td>
                <td className="num">{usd(t.amount_usd)}</td>
                <td>
                  <BadgeView badge={t.result === 'approved' ? { label: 'Approved', tone: 'issued' } : { label: 'Declined', tone: 'declined' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {flags.length > 0 && (
        <ul className="space-y-1.5">
          {flags.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px] text-[#0a2540]">
              <span className="fc-badge fc-badge--flagged">Flagged</span>
              <span>
                {f.text} <span className="text-[#697386]">· receipt from {f.store}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function UsedBar({ pct }: { pct: number }) {
  const over = pct > 90
  return (
    <div className="flex items-center gap-3">
      <div className="h-1 flex-1 rounded-full bg-[#e3e8ee]" role="presentation">
        <div className={`h-1 rounded-full ${over ? 'bg-[#df1b41]' : 'bg-[#5b5bf0]'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`w-10 text-right text-[13px] ${over ? 'font-medium text-[#df1b41]' : 'text-[#697386]'}`}>{Math.round(pct)}%</span>
    </div>
  )
}

function Jobs({ data, details, toggle }: { data: DashboardData; details: Record<string, JobDetailResponse | null>; toggle: (id: string) => boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const flip = (id: string) => {
    const nowOpen = toggle(id)
    setOpen((s) => {
      const next = new Set(s)
      if (nowOpen) next.add(id)
      else next.delete(id)
      return next
    })
  }
  return (
    <section id="jobs" aria-labelledby="jobs-title" className="scroll-mt-28 lg:scroll-mt-8">
      <SectionTitle id="jobs">Jobs</SectionTitle>
      <div className="fc-panel overflow-x-auto">
        <table className="fc-table">
          <thead>
            <tr>
              <th>Job</th>
              <th className="num">Spent / budget</th>
              <th className="hidden w-[34%] sm:table-cell">Used</th>
            </tr>
          </thead>
          <tbody>
            {data.jobs.map((j) => {
              const pct = usedPercent(j.spent_usd, j.materials_budget_usd)
              const isOpen = open.has(j._id)
              return (
                <Fragment key={j._id}>
                  <tr className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => flip(j._id)}>
                    <td>
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={`job-${j._id}`}
                        className="flex items-center gap-2 text-left font-medium text-[#0a2540]"
                        onClick={(e) => {
                          e.stopPropagation()
                          flip(j._id)
                        }}
                      >
                        <span className="w-3 text-[#697386]" aria-hidden>
                          {isOpen ? '▾' : '▸'}
                        </span>
                        <span>
                          {j.name} <span className="whitespace-nowrap font-normal text-[#697386]">{j.code}</span>
                        </span>
                      </button>
                      <div className="ml-5 mt-2 sm:hidden">
                        <UsedBar pct={pct} />
                      </div>
                    </td>
                    <td className="num whitespace-nowrap">
                      {usd(j.spent_usd, 0)} <span className="text-[#697386]">/ {usd(j.materials_budget_usd, 0)}</span>
                    </td>
                    <td className="hidden sm:table-cell">
                      <UsedBar pct={pct} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr id={`job-${j._id}`}>
                      <td colSpan={3} className="bg-[#fafbfc]">
                        <JobPurchases detail={details[j._id]} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Approvals({ data }: { data: DashboardData }) {
  const workerName = (id?: string) => data.workers.find((w) => w._id === id)?.name ?? 'A worker'
  const jobName = (id?: string | null) => data.jobs.find((j) => j._id === id)?.name
  return (
    <section id="approvals" aria-labelledby="approvals-title" className="scroll-mt-28 lg:scroll-mt-8">
      <SectionTitle id="approvals">Approvals</SectionTitle>
      <div className="fc-panel">
        {data.approvals.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-[#697386]">No pending approvals</p>
        ) : (
          <ul>
            {data.approvals.map((a, i) => {
              const r = a.request
              return (
                <li key={a._id} className={`flex items-start justify-between gap-4 px-5 py-4 ${i ? 'border-t border-[#e3e8ee]' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-[14px] text-[#0a2540]">
                      <span className="font-medium">{workerName(r?.worker_id)}</span> · {usd(r?.est_amount_usd)} at {r?.merchant ?? 'a store'}
                      {jobName(r?.job_id) && <span className="text-[#697386]"> · {jobName(r?.job_id)}</span>}
                    </p>
                    {r?.policy?.reasons?.[0] && <p className="mt-1 text-[13px] text-[#697386]">{r.policy.reasons.join(' ')}</p>}
                  </div>
                  <span className="fc-badge fc-badge--flagged shrink-0">Awaiting owner</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="mt-2 text-[13px] text-[#697386]">The owner approves or declines by replying YES or NO to the text.</p>
    </section>
  )
}

function Activity({ data }: { data: DashboardData }) {
  return (
    <section id="activity" aria-labelledby="activity-title" className="scroll-mt-28 lg:scroll-mt-8">
      <SectionTitle id="activity">Activity</SectionTitle>
      <div className="fc-panel overflow-x-auto">
        <table className="fc-table">
          <thead>
            <tr>
              <th className="w-[76px] sm:w-[96px]">Time</th>
              <th>Event</th>
              <th className="num w-[90px] sm:w-[110px]">Amount</th>
              <th className="w-[112px] sm:w-[130px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.activity.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-[#697386]">
                  No activity yet
                </td>
              </tr>
            ) : (
              data.activity.map((a) => {
                const { event, badge } = describeActivity(a.kind, a.message)
                const amount = amountFromMessage(a.message)
                return (
                  <tr key={a._id}>
                    <td className="whitespace-nowrap text-[#697386]">{clockTime(a.at)}</td>
                    <td>
                      <span className="font-medium">{event}</span>
                      <span className="hidden text-[#697386] sm:inline"> · {a.message}</span>
                    </td>
                    <td className="num whitespace-nowrap">{amount == null ? '—' : usd(amount)}</td>
                    <td>
                      <BadgeView badge={badge} />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function DashboardPage() {
  const { data, status, jobDetails, toggleJob, buyAt } = useDashboardData()
  const active = useActiveSection(data !== null)
  return (
    <div className="min-h-screen bg-white text-[#0a2540] lg:flex">
      <Nav active={active} status={status} />
      <main className="relative min-w-0 flex-1 overflow-hidden px-4 pb-24 pt-6 sm:px-8 lg:px-12 lg:pt-10">
        {data ? (
          <div className="mx-auto max-w-[1040px] space-y-12">
            <Overview data={data} buyAt={buyAt} />
            <Jobs data={data} details={jobDetails} toggle={toggleJob} />
            <Approvals data={data} />
            <Activity data={data} />
          </div>
        ) : (
          <p className="text-[14px] text-[#697386]">Loading…</p>
        )}
      </main>
    </div>
  )
}
