/**
 * The single-use card, navy and flat (not rotated, no shadow). Shared by the
 * landing hero and the dashboard's "Latest card".
 */
export function NavyCard({
  last4,
  lines,
  tag,
  size = 'md',
  label,
}: {
  last4: string
  /** e.g. ["Ferguson · Henderson job", "Up to $200 · 4 hours"] */
  lines: string[]
  /** e.g. "Single use" */
  tag?: string
  size?: 'md' | 'lg'
  /** Accessible description of the card */
  label: string
}) {
  const lg = size === 'lg'
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative flex flex-col justify-between rounded-xl bg-[#0a2540] text-white ${
        lg ? 'aspect-[1.586] w-full max-w-[400px] p-7' : 'aspect-[1.586] w-full max-w-[340px] p-5'
      }`}
    >
      <div className="flex items-start justify-between">
        <span className={`block rounded-[4px] bg-gradient-to-br from-[#d9dee6] to-[#9aa6b6] ${lg ? 'h-8 w-11' : 'h-7 w-9'}`} aria-hidden />
        {tag && (
          <span className="rounded-[4px] border border-white/25 px-1.5 py-0.5 text-[11px] font-medium text-white/80">{tag}</span>
        )}
      </div>
      <div>
        <p className={`font-medium tracking-[0.12em] ${lg ? 'text-[22px]' : 'text-lg'}`}>•••• {last4}</p>
        <div className={`mt-2 space-y-0.5 text-white/75 ${lg ? 'text-sm' : 'text-[13px]'}`}>
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      <p className={`absolute bottom-5 right-6 font-semibold italic tracking-tight ${lg ? 'text-2xl' : 'text-xl'}`} aria-hidden>
        VISA
      </p>
    </div>
  )
}
