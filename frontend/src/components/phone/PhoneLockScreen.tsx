import { DEMO_CONTEXT } from '../../demo/smsConversation'

export function PhoneLockScreen({ showTime = true }: { showTime?: boolean }) {
  return (
    <div className="phone-lock-wallpaper relative flex h-full min-h-0 flex-col text-white">
      <div className="flex flex-1 flex-col items-center justify-end pb-8 pt-16">
        {showTime && (
          <p className="text-[52px] font-light leading-none tracking-tight tabular-nums drop-shadow-sm">
            9:41
          </p>
        )}
        <p className="mt-1 text-[15px] font-medium text-white/85">Saturday, October 17</p>
      </div>
      <div className="px-5 pb-6">
        <p className="text-center text-[11px] text-white/50">
          {DEMO_CONTEXT.company} · Field team device
        </p>
      </div>
    </div>
  )
}
