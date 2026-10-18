import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { BurnSeries } from '../api/liveMapping'
import { formatCurrencyPrecise, formatDateTime } from '../lib/format'

const HEIGHT = 200
const PAD = { top: 16, right: 64, bottom: 26, left: 44 }
const SERIES = '#4f46e5' // indigo-600: validated against the white card surface
const usd = formatCurrencyPrecise

function compactUsd(cents: number) {
  const dollars = cents / 100
  return dollars >= 1000 ? `$${(dollars / 1000).toFixed(dollars % 1000 === 0 ? 0 : 1)}K` : `$${Math.round(dollars)}`
}

function niceStep(max: number) {
  const raw = max / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Cumulative materials spend for one job, against its budget. One series, so the title names it (no legend). */
export function SpendChart({ series }: { series: BurnSeries }) {
  const [ref, width] = useWidth()
  const [active, setActive] = useState<number | null>(null)
  const pts = series.points

  const geo = useMemo(() => {
    const times = pts.map((p) => new Date(p.at).getTime())
    const t0 = Math.min(...times)
    const t1 = Math.max(...times, t0 + 1)
    const yMaxRaw = Math.max(series.budgetCents, ...pts.map((p) => p.spentCents), 1)
    const step = niceStep(yMaxRaw)
    const yMax = Math.ceil((yMaxRaw * 1.04) / step) * step
    const innerW = Math.max(width - PAD.left - PAD.right, 1)
    const innerH = HEIGHT - PAD.top - PAD.bottom
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * innerW
    const y = (c: number) => PAD.top + innerH - (c / yMax) * innerH
    const xy = pts.map((p, i) => ({ x: x(times[i]), y: y(p.spentCents) }))
    // Step-after: spend only changes at the moment a purchase clears.
    let line = `M${xy[0].x},${xy[0].y}`
    for (let i = 1; i < xy.length; i++) line += ` H${xy[i].x} V${xy[i].y}`
    const area = `${line} V${y(0)} H${xy[0].x} Z`
    const ticks = Array.from({ length: Math.floor(yMax / step) + 1 }, (_, i) => i * step)
    return { xy, line, area, ticks, y, base: y(0), right: PAD.left + innerW }
  }, [pts, series.budgetCents, width])

  const last = pts[pts.length - 1]
  const lastXY = geo.xy[geo.xy.length - 1]
  const purchases = pts.filter((p) => p.amountCents != null)

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - box.left
    let best = 0
    geo.xy.forEach((p, i) => {
      if (Math.abs(p.x - px) < Math.abs(geo.xy[best].x - px)) best = i
    })
    setActive(best)
  }
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    setActive((a) => {
      const i = a ?? pts.length - 1
      return Math.min(pts.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))
    })
  }

  const tip = active == null ? null : { p: pts[active], at: geo.xy[active] }
  const summary = `Materials spend went from ${usd(pts[0].spentCents)} to ${usd(last.spentCents)} of a ${usd(series.budgetCents)} budget, across ${purchases.length} tracked purchase${purchases.length === 1 ? '' : 's'}.`

  return (
    <div>
      <div ref={ref} className="relative" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={summary}
            tabIndex={0}
            className="block touch-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            onPointerMove={pick}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(pts.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
          >
            {geo.ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={geo.right} y1={geo.y(t)} y2={geo.y(t)} stroke="#f1f5f9" strokeWidth={1} />
                <text x={PAD.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px]">
                  {compactUsd(t)}
                </text>
              </g>
            ))}

            {/* Budget reference line, labelled directly */}
            <line x1={PAD.left} x2={geo.right} y1={geo.y(series.budgetCents)} y2={geo.y(series.budgetCents)} stroke="#94a3b8" strokeWidth={1} />
            <text x={geo.right + 6} y={geo.y(series.budgetCents)} dy="0.32em" className="fill-slate-500 text-[10px] font-medium">
              Budget
            </text>

            <path d={geo.area} fill={SERIES} fillOpacity={0.1} />
            <path d={geo.line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {pts.map((p, i) =>
              p.amountCents != null ? (
                <circle key={i} cx={geo.xy[i].x} cy={geo.xy[i].y} r={4} fill={SERIES} stroke="#ffffff" strokeWidth={2} />
              ) : null,
            )}

            {/* Current total at the line's end */}
            <text x={lastXY.x + 6} y={lastXY.y} dy={Math.abs(lastXY.y - geo.y(series.budgetCents)) < 14 ? '1.2em' : '0.32em'} className="fill-slate-900 text-[11px] font-semibold">
              {compactUsd(last.spentCents)}
            </text>

            <text x={PAD.left} y={HEIGHT - 6} className="fill-slate-400 text-[10px]">
              {formatDateTime(pts[0].at)}
            </text>
            <text x={geo.right} y={HEIGHT - 6} textAnchor="end" className="fill-slate-400 text-[10px]">
              Now
            </text>

            {tip && (
              <g pointerEvents="none">
                <line x1={tip.at.x} x2={tip.at.x} y1={PAD.top} y2={geo.base} stroke="#cbd5e1" strokeWidth={1} />
                <circle cx={tip.at.x} cy={tip.at.y} r={5} fill={SERIES} stroke="#ffffff" strokeWidth={2} />
              </g>
            )}
          </svg>
        )}

        {tip && (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
            style={{ left: Math.min(Math.max(tip.at.x, 90), width - 90), top: Math.max(tip.at.y - 64, 0) }}
            role="status"
          >
            <p className="text-white/60">{tip.p === last ? 'Now' : formatDateTime(tip.p.at)}</p>
            <p className="fc-num font-semibold">{usd(tip.p.spentCents)} spent</p>
            {tip.p.amountCents != null ? (
              <p className="text-white/75">
                +{usd(tip.p.amountCents)} at {tip.p.merchant}
              </p>
            ) : active === 0 ? (
              <p className="text-white/75">Spend before tracked purchases</p>
            ) : null}
          </div>
        )}
      </div>

      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer select-none font-medium text-slate-600 hover:text-slate-900">Show data</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-slate-400">
              <th className="py-1 font-medium">When</th>
              <th className="py-1 font-medium">Purchase</th>
              <th className="py-1 text-right font-medium">Total spent</th>
            </tr>
          </thead>
          <tbody className="fc-num">
            {pts.map((p, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1">{i === pts.length - 1 ? 'Now' : formatDateTime(p.at)}</td>
                <td className="py-1">{p.amountCents != null ? `${usd(p.amountCents)} at ${p.merchant}` : i === 0 ? 'Starting spend' : '—'}</td>
                <td className="py-1 text-right text-slate-900">{usd(p.spentCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
