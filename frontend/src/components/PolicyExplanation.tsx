import { Bot, CheckCircle2, XCircle } from 'lucide-react'
import { formatDateTime, formatPercent } from '../lib/format'
import type { PolicyDecision } from '../types'
import { Badge } from './ui/Badge'
import { Card } from './ui/Card'

export function PolicyExplanation({ decision }: { decision: PolicyDecision }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">AI policy decision</h2>
              <p className="text-sm text-slate-500">
                Evaluated {formatDateTime(decision.evaluatedAt)} ·{' '}
                {formatPercent(decision.confidence * 100, 0)} confidence
              </p>
            </div>
            <div className="ml-auto">
              <Badge variant={decision.approved ? 'success' : 'danger'}>
                {decision.approved ? 'Approved' : 'Not approved'}
              </Badge>
            </div>
          </div>
          <p className="mt-4 text-sm font-medium text-slate-800">{decision.summary}</p>
        </div>
        <div className="px-6 py-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Rule evaluation
          </h3>
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
        <h3 className="text-sm font-semibold text-slate-900">Agent explanation</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          {decision.aiNarrative}
        </p>
      </Card>
    </div>
  )
}
