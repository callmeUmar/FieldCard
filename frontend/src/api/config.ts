const DEFAULT_API_URL = 'https://fieldcard.onrender.com'

/** Backend base URL from VITE_API_URL (or NEXT_PUBLIC_API_URL), never localhost by default. */
export const API_URL = (
  import.meta.env.VITE_API_URL || import.meta.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL
).replace(/\/+$/, '')

/** How often the activity feed polls the backend while live */
export const ACTIVITY_POLL_MS = 2_000
/** How often to retry the backend while showing offline demo data */
export const OFFLINE_RETRY_MS = 10_000
/** A request slower than this counts as "backend unreachable" (Render cold starts take longer, so polling keeps retrying) */
export const REQUEST_TIMEOUT_MS = 8_000
