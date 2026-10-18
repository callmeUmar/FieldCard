/**
 * Check or cross that draws itself once when it mounts (static under
 * prefers-reduced-motion) — the same mark the landing page uses for approval.
 */
export function DrawnMark({
  kind,
  className = '',
}: {
  kind: 'check' | 'cross'
  className?: string
}) {
  return (
    <svg viewBox="0 0 24 24" className={`drawn-mark ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="10.5" pathLength={1} className="drawn-mark-ring" />
      {kind === 'check' ? (
        <path d="M7.4 12.4 L10.6 15.6 L16.8 9" pathLength={1} className="drawn-mark-stroke" />
      ) : (
        <path d="M8.5 8.5 L15.5 15.5 M15.5 8.5 L8.5 15.5" pathLength={1} className="drawn-mark-stroke" />
      )}
    </svg>
  )
}
