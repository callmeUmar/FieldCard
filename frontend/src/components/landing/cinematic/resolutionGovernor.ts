/**
 * Decides the WebGL pixel ratio for the cinematic canvas.
 *
 * - Whenever the scene comes to rest it returns to full resolution, so whatever
 *   a visitor stops to look at is rendered at the device's native density —
 *   independent of scroll direction or how long they have been scrolling.
 * - While the scene is moving it may step down, but only when the *median*
 *   time between continuously rendered frames shows sustained load.
 *
 * The previous heuristic only ever stepped down. With on-demand rendering,
 * slow scrolling produces long gaps between frames that it mistook for a slow
 * GPU, so after the first slow stretch every later chapter — including the
 * whole way back up — rendered at 1.5× and then 1×.
 */
export type ResolutionGovernor = {
  readonly current: number
  /** Time since the previous rendered frame. Returns a new pixel ratio, or null if unchanged. */
  sample(delta: number): number | null
  /** The scene settled. Returns the restored pixel ratio, or null if already there. */
  rest(): number | null
}

export function createResolutionGovernor({
  max,
  min = 1,
  window = 45,
  slow = 1 / 40,
  step = 0.5,
}: {
  max: number
  min?: number
  window?: number
  /** Median frame time (s) above which the load counts as sustained. */
  slow?: number
  step?: number
}): ResolutionGovernor {
  let current = max
  let samples: number[] = []
  return {
    get current() {
      return current
    },
    sample(delta) {
      // Gaps between on-demand frames (or a background tab) are not render cost.
      if (!(delta > 0) || delta > 0.1) return null
      samples.push(delta)
      if (samples.length < window) return null
      const sorted = [...samples].sort((a, b) => a - b)
      samples = []
      if (sorted[sorted.length >> 1] <= slow || current <= min) return null
      current = Math.max(min, current - step)
      return current
    },
    rest() {
      samples = []
      if (current === max) return null
      current = max
      return current
    },
  }
}
