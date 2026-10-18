import { Bot, Check, Clock3, Cpu, Stamp, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDateTime } from '../lib/format'
import type { PolicyDecision } from '../types'
import { TONE_CLASSES, type Tone } from './ui/statusMeta'

/**
 * Decision breakdown in three separate layers: what the AI understood, what
 * the deterministic rules decided, and the final authorization.
 */
export function PolicyExplanation({ decision, pending = false }: { decision: PolicyDecision; pending?: boolean }) {
  const passed = decision.rules.filter((r) => r.passed).length
  const tone: Tone = decision.approved ? 'approved' : pending ? 'review' : 'declined'
  const verdict = decision.approved ? 'Authorized' : pending ? 'Awaiting owner approval' : 'Not authorized'
  const VerdictIcon = decision.approved ? Check : pending ? Clock3 : X

  return (
    <ol className="space-y-4">
      {/* 1 · AI interpretation */}
      <Layer index={1} icon={Bot} title="AI request interpretation" note="Natural-language context from the field agent. It explains the request; it does not decide it.">
        <p className="text-sm leading-relaxed text-slate-700">{decision.aiNarrative}</p>
      </Layer>

      {/* 2 · Deterministic rules */}
      <Layer
        index={2}
        icon={Cpu}
        title="Deterministic policy evaluation"
        note="Rule engine only — the same inputs always give the same outcome. No model scores."
        aside={
          <span className="fc-num rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            {passed} / {decision.rules.length} passed
          </span>
        }
      >
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100">
          {decision.rules.map((rule) => {
            const ruleTone: Tone = rule.passed ? 'approved' : rule.ruleId === 'r-approval' ? 'review' : 'declined'
            return (
              <li key={rule.ruleId} className="flex gap-3 px-4 py-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${TONE_CLASSES[ruleTone]}`}
                  aria-label={rule.passed ? 'Passed' : 'Not passed'}
                >
                  {rule.passed ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-sm font-medium text-slate-900">{rule.title}</p>
                    {rule.detail && <p className="fc-num text-xs text-slate-600">{rule.detail}</p>}
                  </div>
                  <p className="text-[13px] text-slate-500">{rule.description}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </Layer>

      {/* 3 · Final result */}
      <Layer index={3} icon={Stamp} title="Authorization result" note={`Evaluated ${formatDateTime(decision.evaluatedAt)} · sandbox simulation, no real charge`}>
        <div className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-inset ${TONE_CLASSES[tone]}`}>
          <VerdictIcon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
          <div>
            <p className="font-semibold">{verdict}</p>
            <p className="mt-0.5 text-sm opacity-90">{decision.summary}</p>
          </div>
        </div>
      </Layer>
    </ol>
  )
}

function Layer({
  index,
  icon: Icon,
  title,
  note,
  aside,
  children,
}: {
  index: number
  icon: typeof Bot
  title: string
  note: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <li className={`fc-enter fc-enter-${index} rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
          <div>
            <p className="fc-kicker text-[9.5px] text-slate-400">Layer {index}</p>
            <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{note}</p>
          </div>
        </div>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </li>
  )
}
