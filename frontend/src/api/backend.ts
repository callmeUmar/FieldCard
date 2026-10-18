import { API_URL, REQUEST_TIMEOUT_MS } from './config'
import type {
  ActivityDocument,
  ApprovalDocument,
  HealthResponse,
  JobDetailResponse,
  LiveJobDocument,
  LivePurchaseRequest,
  LivePurchaseResponse,
  OverviewResponse,
  WorkerDocument,
} from '../types/contracts'

/** The backend can't be reached (network error, timeout, 5xx, or a 404 from an older deploy). */
export class BackendUnavailableError extends Error {
  constructor(message = 'Backend unreachable') {
    super(message)
    this.name = 'BackendUnavailableError'
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
  // 404: a backend deploy without this endpoint (or no seeded company). Treat as offline.
  if (response.status >= 500 || response.status === 404) throw new BackendUnavailableError(`Backend ${response.status}`)
  if (!response.ok) {
    const detail = await response.json().then((b: { detail?: unknown }) => b.detail, () => undefined)
    throw new Error(typeof detail === 'string' ? detail : `Request failed (${response.status})`)
  }
  return (await response.json()) as T
}

/** Every backend call the frontend makes. */
export const backend = {
  health: () => request<HealthResponse>('/health'),
  overview: () => request<OverviewResponse>('/api/overview'),
  jobs: () => request<LiveJobDocument[]>('/api/jobs'),
  job: (jobId: string) => request<JobDetailResponse>(`/api/jobs/${encodeURIComponent(jobId)}`),
  workers: () => request<WorkerDocument[]>('/api/workers'),
  pendingApprovals: () => request<ApprovalDocument[]>('/api/approvals?status=pending'),
  activity: (limit = 50) => request<ActivityDocument[]>(`/api/activity?limit=${limit}`),
  purchase: (body: LivePurchaseRequest) =>
    request<LivePurchaseResponse>('/api/simulate/purchase', { method: 'POST', body: JSON.stringify(body) }),
}
