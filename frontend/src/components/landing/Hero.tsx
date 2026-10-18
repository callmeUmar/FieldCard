import { useEffect, useState } from 'react'
import { backend } from '../../api/backend'
import { usd } from '../../dashboard/format'
import { NavyCard } from '../brand/NavyCard'
import { ThreadMotif } from '../brand/ThreadMotif'

/** "Tracked on Fieldcard today", read live from the backend; hidden if it can't be reached. */
function useTrackedToday(): number | null {
  const [tracked, setTracked] = useState<number | null>(null)
  useEffect(() => {
    let cancelled = false
    backend
      .overview()
      .then((o) => !cancelled && setTracked(o.tracked_today_usd))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])
  return tracked
}

export function Hero() {
  const tracked = useTrackedToday()
  return (
    <section className="lx-hero relative overflow-hidden bg-white" aria-labelledby="hero-title">
      {/* The signature lines sweep across the right side; the card rests on them */}
      <ThreadMotif className="pointer-events-none absolute -right-24 top-6 h-[620px] w-[min(980px,80vw)] max-lg:top-[300px] max-lg:w-[140vw]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-32 lg:pt-20">
        <div>
          {tracked !== null && (
            <p className="text-[13px] font-medium text-[#697386]">
              Tracked on Fieldcard today: <span className="text-[#0a2540]">{usd(tracked)}</span>
            </p>
          )}
          <h1 id="hero-title" className="mt-4 text-[42px] font-semibold leading-[1.04] tracking-[-0.035em] text-[#0a2540] sm:text-[56px]">
            Every purchase, tied to the job.
          </h1>
          <p className="mt-5 max-w-md text-[19px] leading-snug text-[#697386]">
            A text becomes a card for one store, one amount, four hours.
          </p>
        </div>

        <div className="relative flex flex-col items-center gap-4 lg:items-end">
          <p className="self-center rounded-[12px] rounded-br-[4px] border border-[#e3e8ee] bg-white px-4 py-2.5 text-[15px] text-[#0a2540] lg:mr-10 lg:self-end">
            Elbows at Ferguson, $160
          </p>
          <NavyCard
            size="lg"
            last4="4417"
            lines={['Ferguson · Henderson job', 'Up to $200 · 4 hours']}
            tag="Single use"
            label="Single-use card ending 4417 for Ferguson on the Henderson job, up to $200 for 4 hours"
          />
        </div>
      </div>
    </section>
  )
}
