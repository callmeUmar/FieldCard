import type { ReactNode } from 'react'
import { PhoneStatusBar } from './PhoneStatusBar'

export function IPhoneFrame({
  children,
  className = '',
  heroEntrance = false,
  statusBarTheme = 'dark',
  fullBleed = false,
  hideIslandOverlap = false,
}: {
  children: ReactNode
  className?: string
  /** Hero landing entrance animation */
  heroEntrance?: boolean
  statusBarTheme?: 'light' | 'dark'
  /** Child covers entire screen (lock screen); status bar overlays on top */
  fullBleed?: boolean
  hideIslandOverlap?: boolean
}) {
  return (
    <div
      className={`phone-perspective mx-auto w-full max-w-[min(100%,320px)] ${className}`}
    >
      <div
        className={`phone-device relative ${heroEntrance ? 'phone-hero-enter' : ''}`}
      >
        {/* Side buttons */}
        <div
          className="pointer-events-none absolute -left-[3px] top-[20%] z-10 h-[26px] w-[3px] rounded-l-[2px] bg-gradient-to-r from-[#8a8a92] via-[#d4d4dc] to-[#6e6e78] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-[3px] top-[28%] z-10 h-[48px] w-[3px] rounded-l-[2px] bg-gradient-to-r from-[#8a8a92] via-[#d4d4dc] to-[#6e6e78] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -left-[3px] top-[36%] z-10 h-[48px] w-[3px] rounded-l-[2px] bg-gradient-to-r from-[#8a8a92] via-[#d4d4dc] to-[#6e6e78] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-[3px] top-[24%] z-10 h-[72px] w-[3px] rounded-r-[2px] bg-gradient-to-l from-[#8a8a92] via-[#e8e8f0] to-[#6e6e78] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
          aria-hidden
        />

        {/* Titanium shell */}
        <div
          className="phone-shell relative rounded-[3rem] p-[3px] shadow-[0_50px_100px_-24px_rgba(8,12,28,0.75),0_24px_48px_-20px_rgba(79,70,229,0.25),0_0_0_1px_rgba(255,255,255,0.12)_inset]"
        >
          <div
            className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-[#f0f0f5] via-[#b8b8c4] to-[#5c5c68] opacity-100"
            aria-hidden
          />
          <div
            className="absolute inset-[1px] rounded-[2.9rem] bg-gradient-to-br from-[#2a2a32] via-[#1a1a20] to-[#0c0c10]"
            aria-hidden
          />
          <div
            className="absolute inset-[2px] rounded-[2.85rem] bg-gradient-to-tr from-white/20 via-transparent to-white/5"
            aria-hidden
          />

          {/* Screen bezel */}
          <div className="relative overflow-hidden rounded-[2.75rem] bg-black p-[2px]">
            <div
              className="phone-screen relative flex aspect-[393/852] w-full flex-col overflow-hidden bg-[#f2f2f7]"
            >
              <div
                className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-br from-white/25 via-transparent to-transparent opacity-40"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -right-8 top-0 z-30 h-2/3 w-1/2 rotate-12 bg-gradient-to-l from-white/10 to-transparent"
                aria-hidden
              />

              {fullBleed ? (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {!hideIslandOverlap && (
                    <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
                      <PhoneStatusBar theme={statusBarTheme} />
                    </div>
                  )}
                  <div className="relative min-h-0 flex-1">{children}</div>
                </div>
              ) : (
                <>
                  <PhoneStatusBar theme={statusBarTheme} />
                  <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
