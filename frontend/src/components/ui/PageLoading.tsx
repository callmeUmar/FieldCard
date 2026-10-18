export function PageLoading({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center gap-3 text-sm text-slate-500" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 motion-reduce:animate-none" aria-hidden />
      {label}
    </div>
  )
}
