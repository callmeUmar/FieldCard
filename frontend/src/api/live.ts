import { API_URL, REQUEST_TIMEOUT_MS } from './config'
import type {
  ActivityDocument,
  BurnResponse,
  DashboardResponse,
  DemoCardRequest,
  DemoCardResponse,
  LivePurchaseRequest,
  LivePurchaseResponse,
} from '../types/contracts'

/** The backend can't be reached (network error, timeout, 5xx/503). Callers fall back to offline data. */
export class BackendUnavailableError extends Error {
  constructor(message = 'Backend unreachable') {
    super(message)
    this.name = 'BackendUnavailableError'
  }
}

/** The backend answered but refused the request (4xx). Not a reason to go offline. */
export class BackendRequestError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'BackendRequestError'
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
      signal: controller.signal,
    })
  } catch {
    throw new BackendUnavailableError()
  } finally {
    clearTimeout(timer)
  }
  if (response.status >= 500) throw new BackendUnavailableError(`Backend error ${response.status}`)
  if (!response.ok) {
    const detail = await response.json().then((b: { detail?: unknown }) => b.detail, () => undefined)
    throw new BackendRequestError(response.status, typeof detail === 'string' ? detail : `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

/** Thin client for the deployed backend's endpoints */
export const liveBackend = {
  dashboard: () => request<DashboardResponse>('/api/dashboard'),
  activity: (limit = 100) => request<ActivityDocument[]>(`/api/activity?limit=${limit}`),
  burn: (jobId: string) => request<BurnResponse>(`/api/jobs/${encodeURIComponent(jobId)}/burn`),
  simulatePurchase: (body: LivePurchaseRequest) => post<LivePurchaseResponse>('/api/simulate/purchase', body),
  requestCard: (body: DemoCardRequest) => post<DemoCardResponse>('/api/dev/request-card', body),
}
