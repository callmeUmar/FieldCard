import { Loader2 } from 'lucide-react'
import type { PolicyRuleHit } from '../../types'
import { DrawnMark } from './DrawnMark'

export function PolicyStepList({
  rules,
  revealedCount,
}: {
  rules: PolicyRuleHit[]
  revealedCount: number
}) {
  return (
    <ul className="space-y-2">
      {rules.map((rule, index) => {
        const visible = index < revealedCount
        const pending = index === revealedCount
        if (!visible && !pending) return null

        return (
          <li
            key={rule.ruleId}
            className={`flex gap-3 rounded-xl border px-4 py-3 transition-all duration-500 ${
              visible
                ? rule.passed
                  ? 'border-emerald-200 bg-emerald-50/80'
                  : 'border-rose-200 bg-rose-50/80'
                : 'border-slate-200 bg-slate-50'
            } ${visible ? 'animate-fade-in-up opacity-100' : 'opacity-70'}`}
          >
            {pending ? (
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-slate-400" />
            ) : rule.passed ? (
              <DrawnMark kind="check" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <DrawnMark kind="cross" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{rule.title}</p>
              <p className="text-sm text-slate-600">{rule.description}</p>
              {visible && rule.detail && (
                <p className="mt-1 text-xs font-medium text-slate-700">{rule.detail}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
