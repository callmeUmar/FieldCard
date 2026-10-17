import { Bot, CheckCircle2, Shield, XCircle } from 'lucide-react'
import { formatDateTime } from '../lib/format'
import type { PolicyDecision } from '../types'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'

export function PolicyExplanation({ decision }: { decision: PolicyDecision }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Authorization result
              </h2>
              <p className="text-sm text-slate-500">
                Evaluated {formatDateTime(decision.evaluatedAt)}
              </p>
            </div>
            <div className="ml-auto">
              <Badge variant={decision.approved ? 'success' : 'danger'}>
                {decision.approved ? 'Authorized' : 'Not authorized'}
              </Badge>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-800">{decision.summary}</p>
        </div>
        <div className="px-6 py-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Deterministic policy evaluation
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Rule engine only — not a probabilistic model score.
          </p>
          <ul className="mt-4 space-y-3">
            {decision.rules.map((rule) => (
              <li
                key={rule.ruleId}
                className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3"
              >
                {rule.passed ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                )}
                <div>
                  <p className="text-sm font-medium text-slate-900">{rule.title}</p>
                  <p className="text-sm text-slate-500">{rule.description}</p>
                  {rule.detail && (
                    <p className="mt-1 text-xs text-slate-600">{rule.detail}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            AI request interpretation
          </h3>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Natural-language context from the field agent — separate from rule outcomes
          above.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {decision.aiNarrative}
        </p>
      </Card>
    </div>
  )
}
