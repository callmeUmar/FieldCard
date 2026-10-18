import type { ReactNode } from 'react'
import { useInView } from '../../hooks/useInView'

/** Kicker, headline and lede with the landing page's shared reveal. */
export function SectionIntro({
  id,
  kicker,
  title,
  children,
  className = '',
}: {
  id: string
  kicker: string
  title: ReactNode
  children?: ReactNode
  className?: string
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.4 })
  return (
    <div ref={ref} className={`lx-intro ${className}`} data-inview={inView}>
      <p className="landing-kicker lx-reveal">{kicker}</p>
      <h2 id={id} className="landing-h2 lx-reveal lx-reveal-mask mt-4">
        {title}
      </h2>
      {children && <p className="lx-lede lx-reveal">{children}</p>}
    </div>
  )
}
