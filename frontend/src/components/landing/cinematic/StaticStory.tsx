import heroTall from '../../../assets/cinematic/hero-tall.jpg'
import heroWide from '../../../assets/cinematic/hero-wide.jpg'
import stillCard from '../../../assets/cinematic/still-card.jpg'
import stillDecision from '../../../assets/cinematic/still-decision.jpg'
import stillLimits from '../../../assets/cinematic/still-limits.jpg'
import stillPolicy from '../../../assets/cinematic/still-policy.jpg'
import stillRequest from '../../../assets/cinematic/still-request.jpg'
import { AMOUNT, DECISION_META } from './story'
import { ApprovalCheck, BeatCopy, HeroCopy, PayoffChapter } from './StoryCopy'

/**
 * Reduced-motion / no-WebGL version: the same story as still frames rendered
 * from the 3D scene. No scroll choreography, and the 3D runtime is never fetched.
 */

const FRAMES = [
  { id: 'request', src: stillRequest, alt: 'Phone lock screen showing a Fieldcard notification for the Henderson job' },
  { id: 'policy', src: stillPolicy, alt: 'Simulated SMS thread in which Fieldcard checks the budget, limit and merchant category' },
  { id: 'card', src: stillCard, alt: 'A virtual sandbox card lifting out of the phone' },
  { id: 'limits', src: stillLimits, alt: 'The back of the card listing job HEN-1042, a $186.50 cap, MCC 5074, a 4-hour expiry and single use' },
] as const

export function StaticStory() {
  return (
    <>
      <section className="cine-static-hero">
        <picture>
          <source media="(max-aspect-ratio: 1/1)" srcSet={heroTall} />
          <img src={heroWide} alt="" />
        </picture>
        <div className="cine-container">
          <HeroCopy />
        </div>
      </section>

      <section className="cine-static" aria-label="How a text message becomes a controlled purchase">
        <div className="cine-container">
          {FRAMES.map((f) => (
            <figure key={f.id} className="cine-static-frame">
              <img src={f.src} alt={f.alt} loading="lazy" decoding="async" />
              <figcaption className="cine-static-copy">
                <BeatCopy id={f.id} as="h3" />
              </figcaption>
            </figure>
          ))}

          <figure className="cine-static-frame cine-static-frame--center">
            <img src={stillDecision} alt="The approved virtual card" loading="lazy" decoding="async" />
            <figcaption className="cine-static-copy">
              <p className="cine-kicker cine-kicker--center">05 · Decision</p>
              <ApprovalCheck />
              <h3 className="cine-approve-word">
                <span>Approved</span>
              </h3>
              <p className="cine-approve-amount">{AMOUNT}</p>
              <p className="cine-approve-meta">{DECISION_META}</p>
            </figcaption>
          </figure>

          <div className="cine-static-payoff">
            <PayoffChapter resolved as="h3" />
          </div>
        </div>
      </section>
    </>
  )
}
