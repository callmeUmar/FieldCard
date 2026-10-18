import { Briefcase, Check, Clock3, CreditCard, Gauge, Store, UserRound, X } from 'lucide-react'
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { BLOCKED_PURCHASE, DEMO_VIRTUAL_CARD } from '../../demo/liveAgentScenario'
import { CONTROLS, type Control, type ControlExample, type ControlId, type Scale } from './landingSectionsData'
import { SectionIntro } from './SectionIntro'

/*
 * Spending controls — pick a rule, then flip between a purchase that passes it
 * and one that does not. Outcomes come from the real policy engine (see
 * landingSectionsData); this section only reads them.
 */

const ICONS: Record<ControlId, typeof Check> = {
  budget: Briefcase,
  worker: UserRound,
  mcc: Store,
  threshold: Gauge,
  'single-use': CreditCard,
  expiry: Clock3,
}

/** Standard Visa MCC descriptions for the categories in the seed data */
const MCC_NAMES: Record<string, string> = {
  '5074': 'Plumbing & heating supplies',
  '5200': 'Home supply warehouse',
}

type Mode = 'pass' | 'fail'

export function SpendingControls() {
  const [selected, setSelected] = useState<ControlId>('mcc')
  const [mode, setMode] = useState<Mode>('pass')
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const control = CONTROLS.find((c) => c.id === selected)!
  const example = control[mode]

  const select = (id: ControlId) => {
    setSelected(id)
    setMode('pass')
  }

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    let next = delta === undefined ? -1 : (index + delta + CONTROLS.length) % CONTROLS.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = CONTROLS.length - 1
    if (next < 0) return
    e.preventDefault()
    select(CONTROLS[next].id)
    tabRefs.current[CONTROLS[next].id]?.focus()
  }

  return (
    <section id="controls" className="lx-section lx-ctl" aria-labelledby="ctl-heading">
      <div className="lx-container lx-ctl-grid">
        <div>
          <SectionIntro id="ctl-heading" kicker="Spending controls" title="Controls that work at the counter.">
            Your techs will not stop for expense software. Fieldcard enforces six rules on every request — pick one to
            see it decide.
          </SectionIntro>

          <div className="lx-ctl-tabs" role="tablist" aria-label="Spending controls" aria-orientation="vertical">
            {CONTROLS.map((c, i) => {
              const Icon = ICONS[c.id]
              const isActive = c.id === selected
              return (
                <button
                  key={c.id}
                  ref={(el) => {
                    tabRefs.current[c.id] = el
                  }}
                  type="button"
                  role="tab"
                  id={`ctl-tab-${c.id}`}
                  aria-selected={isActive}
                  aria-controls="ctl-panel"
                  tabIndex={isActive ? 0 : -1}
                  className="lx-ctl-tab"
                  onClick={() => select(c.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                >
                  <span className="lx-ctl-tab-icon" aria-hidden>
                    <Icon strokeWidth={1.75} />
                  </span>
                  <span className="lx-ctl-tab-text">
                    <span className="lx-ctl-tab-name">{c.name}</span>
                    <span className="lx-ctl-tab-short">{c.short}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div
          id="ctl-panel"
          role="tabpanel"
          aria-labelledby={`ctl-tab-${control.id}`}
          className="lx-ctl-panel"
          data-outcome={example.evaluation.status}
        >
          <div key={control.id} className="lx-ctl-panel-body">
            <div className="lx-ctl-panel-head">
              <h3 className="lx-ctl-rule">{control.name}</h3>
              <p className="lx-ctl-statement">{control.statement}</p>
            </div>

            <div className="lx-seg" role="group" aria-label="Example purchase">
              <span className="lx-seg-thumb" data-mode={mode} aria-hidden />
              {(['pass', 'fail'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="lx-seg-btn"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                >
                  {m === 'pass' ? 'Within policy' : control.failLabel}
                </button>
              ))}
            </div>

            <div className="lx-ctl-visual">
              <RuleVisual control={control} example={example} mode={mode} />
            </div>

            <Receipt example={example} />
          </div>
          <p className="lx-ctl-foot">Illustrative sandbox example · evaluated by the demo's policy engine · no real transaction</p>
        </div>
      </div>
    </section>
  )
}

function Receipt({ example }: { example: ControlExample }) {
  const { status, summary } = example.evaluation
  const label = status === 'approved' ? 'Approved' : status === 'pending' ? 'Needs approval' : 'Declined'
  const Icon = status === 'approved' ? Check : status === 'pending' ? Clock3 : X
  return (
    <div className="lx-receipt" data-outcome={status}>
      <dl className="lx-receipt-rows">
        <div>
          <dt>Worker</dt>
          <dd>{example.who}</dd>
        </div>
        <div>
          <dt>Job</dt>
          <dd>{example.where}</dd>
        </div>
        <div>
          <dt>Merchant</dt>
          <dd>{example.merchant}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd className="lx-num">{example.amount}</dd>
        </div>
      </dl>
      <div className="lx-receipt-outcome" aria-live="polite">
        <span key={`${example.merchant}-${status}-${example.who}-${summary}`} className="lx-outcome-badge">
          <Icon strokeWidth={2.5} aria-hidden />
          {label}
        </span>
        <span className="lx-outcome-reason">{reasonText(summary)}</span>
      </div>
    </div>
  )
}

/** The badge already says the verdict; show only the engine's reason after it */
function reasonText(summary: string) {
  const reason = summary.replace(/^(Approved|Pending owner approval) — /, '')
  return reason.charAt(0).toUpperCase() + reason.slice(1)
}

function RuleVisual({ control, example, mode }: { control: Control; example: ControlExample; mode: Mode }) {
  if (control.visual === 'mcc') return <MccVisual mode={mode} />
  if (control.visual === 'uses') return <UsesVisual mode={mode} amount={example.amount} />
  return example.scale ? <ScaleVisual scale={example.scale} status={example.evaluation.status} note={example.note} /> : null
}

/** One track for budgets, caps, thresholds and the expiry clock */
function ScaleVisual({ scale, status, note }: { scale: Scale; status: string; note: string }) {
  // Leave headroom when the purchase overflows the limit, so the overflow is visible
  const domain = Math.max(1, scale.marker, scale.limit) * 1.06
  const pct = (v: number) => `${(Math.min(v, domain) / domain) * 100}%`
  const start = scale.filled ?? 0
  const limitAt = Math.min(scale.limit, domain) / domain
  const align = limitAt > 0.7 ? 'end' : limitAt < 0.3 ? 'start' : 'center'
  return (
    <div
      className="lx-scale"
      data-outcome={status}
      data-align={align}
      style={
        {
          '--s-end': pct(1),
          '--s-filled': pct(start),
          '--s-marker': pct(scale.marker),
          '--s-limit': pct(scale.limit),
        } as CSSProperties
      }
    >
      <div className="lx-scale-limit-label">{scale.limitLabel}</div>
      <div className="lx-scale-track">
        <span className="lx-scale-range" />
        <span className="lx-scale-filled" />
        <span className="lx-scale-purchase" />
        <span className="lx-scale-limit" />
        <span className="lx-scale-marker" />
      </div>
      <div className="lx-scale-ends">
        <span>{scale.min}</span>
        <span className="lx-scale-max">{scale.max}</span>
      </div>
      <p className="lx-scale-note">{note}</p>
    </div>
  )
}

function MccVisual({ mode }: { mode: Mode }) {
  const allowed = DEMO_VIRTUAL_CARD.allowedMccs
  const chips = [...allowed, BLOCKED_PURCHASE.mcc]
  const hit = mode === 'pass' ? allowed[0] : BLOCKED_PURCHASE.mcc
  return (
    <div className="lx-mcc">
      <p className="lx-mcc-label">Card •••• {DEMO_VIRTUAL_CARD.lastFour} · allowed_mccs</p>
      <ul className="lx-mcc-chips">
        {chips.map((mcc) => {
          const isAllowed = allowed.includes(mcc)
          return (
            <li key={mcc} className="lx-mcc-chip" data-allowed={isAllowed} data-hit={mcc === hit}>
              <span className="lx-mcc-code">{mcc}</span>
              <span className="lx-mcc-name">{MCC_NAMES[mcc] ?? 'Merchant category'}</span>
              <span className="lx-mcc-state">{isAllowed ? 'On card' : 'Not on card'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function UsesVisual({ mode, amount }: { mode: Mode; amount: string }) {
  const used = mode === 'fail'
  return (
    <div className="lx-uses" data-used={used}>
      <div className="lx-uses-card">
        <span className="lx-uses-num">•••• {DEMO_VIRTUAL_CARD.lastFour}</span>
        <span className="lx-uses-status">{used ? 'Used' : 'Active'}</span>
      </div>
      <ol className="lx-uses-slots">
        <li data-state={used ? 'spent' : 'this'}>
          <span>Authorization 1</span>
          <strong>{used ? `${amount} · earlier` : `${amount} · this purchase`}</strong>
        </li>
        <li data-state={used ? 'blocked' : 'none'}>
          <span>Authorization 2</span>
          <strong>{used ? `${amount} · refused` : 'Not possible'}</strong>
        </li>
      </ol>
    </div>
  )
}
