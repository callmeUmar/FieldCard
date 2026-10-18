import { useId } from 'react'

const LINES = 9
const GAP = 16

/**
 * Fieldcard's signature: thin parallel curves sweeping diagonally, stroked
 * indigo (#5b5bf0) to teal (#12b5a5). Decorative only.
 */
export function ThreadMotif({ className = '', opacity = 1 }: { className?: string; opacity?: number }) {
  const gradient = useId()
  return (
    <svg className={className} viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden focusable="false" style={{ opacity }}>
      <defs>
        <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#5b5bf0" />
          <stop offset="1" stopColor="#12b5a5" />
        </linearGradient>
      </defs>
      {Array.from({ length: LINES }, (_, i) => {
        const o = i * GAP
        return (
          <path
            key={i}
            d={`M -60 ${600 + o} C 220 ${560 + o}, 400 ${200 + o}, 860 ${40 + o}`}
            fill="none"
            stroke={`url(#${gradient})`}
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
          />
        )
      })}
    </svg>
  )
}
