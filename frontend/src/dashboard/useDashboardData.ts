import { useCallback, useEffect, useRef, useState } from 'react'
import { BackendUnavailableError, backend } from '../api/backend'
import { ACTIVITY_POLL_MS, OFFLINE_RETRY_MS } from '../api/config'
import {
  OFFLINE_ACTIVITY,
  OFFLINE_APPROVALS,
  OFFLINE_JOBS,
  OFFLINE_OVERVIEW,
  OFFLINE_WORKERS,
  offlineJobDetail,
} from '../api/fallback'
import type {
  ActivityDocument,
  ApprovalDocument,
  JobDetailResponse,
  LiveJobDocument,
  OverviewResponse,
  WorkerDocument,
} from '../types/contracts'

const HEALTH_POLL_MS = 10_000
export const DEMO_WORKER_ID = 'w_mike'
export const DEMO_AMOUNT_USD = 160

export interface DashboardData {
  overview: OverviewResponse
  jobs: LiveJobDocument[]
  approvals: ApprovalDocument[]
  activity: ActivityDocument[]
  workers: WorkerDocument[]
}

const OFFLINE: DashboardData = {
  overview: OFFLINE_OVERVIEW,
  jobs: OFFLINE_JOBS,
  approvals: OFFLINE_APPROVALS,
  activity: OFFLINE_ACTIVITY,
  workers: OFFLINE_WORKERS,
}

async function loadLive(): Promise<DashboardData> {
  const [overview, jobs, approvals, activity, workers] = await Promise.all([
    backend.overview(),
    backend.jobs(),
    backend.pendingApprovals(),
    backend.activity(),
    backend.workers(),
  ])
  return { overview, jobs, approvals, activity, workers }
}

/**
 * Everything the dashboard shows. Live from the backend; the offline fallback
 * only when it can't be reached. "Live" requires both a healthy /health and
 * live data.
 */
export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [source, setSource] = useState<'live' | 'offline' | null>(null)
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [jobDetails, setJobDetails] = useState<Record<string, JobDetailResponse | null>>({})
  const newest = useRef<string | null>(null)
  const expanded = useRef<Set<string>>(new Set())

  const loadJob = useCallback(async (jobId: string, live: boolean) => {
    try {
      const detail = live ? await backend.job(jobId) : offlineJobDetail(jobId)
      setJobDetails((d) => ({ ...d, [jobId]: detail }))
    } catch {
      setJobDetails((d) => ({ ...d, [jobId]: offlineJobDetail(jobId) }))
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      const next = await loadLive()
      newest.current = next.activity[0]?._id ?? null
      setData(next)
      setSource('live')
      expanded.current.forEach((id) => void loadJob(id, true))
    } catch (err) {
      if (!(err instanceof BackendUnavailableError)) console.error(err)
      newest.current = null
      setData(OFFLINE)
      setSource('offline')
      expanded.current.forEach((id) => void loadJob(id, false))
    }
  }, [loadJob])

  useEffect(() => {
    // Initial load; state is set once the requests settle
    const t = setTimeout(() => void reload(), 0)
    return () => clearTimeout(t)
  }, [reload])

  // Activity every 2s while live (a new event refreshes everything); retry every 10s while offline.
  useEffect(() => {
    if (!source) return
    let busy = false
    const tick = async () => {
      if (busy) return
      busy = true
      try {
        if (source === 'offline') return await reload()
        const activity = await backend.activity()
        if ((activity[0]?._id ?? null) !== newest.current) await reload()
      } catch {
        await reload()
      } finally {
        busy = false
      }
    }
    const id = setInterval(() => void tick(), source === 'live' ? ACTIVITY_POLL_MS : OFFLINE_RETRY_MS)
    return () => clearInterval(id)
  }, [source, reload])

  // Sidebar status dot: GET /health
  useEffect(() => {
    let stopped = false
    const check = () =>
      backend
        .health()
        .then((h) => !stopped && setHealthy(h.ok && h.db === 'ok'))
        .catch(() => !stopped && setHealthy(false))
    void check()
    const id = setInterval(check, HEALTH_POLL_MS)
    return () => {
      stopped = true
      clearInterval(id)
    }
  }, [])

  const toggleJob = useCallback(
    (jobId: string) => {
      if (expanded.current.has(jobId)) {
        expanded.current.delete(jobId)
      } else {
        expanded.current.add(jobId)
        void loadJob(jobId, source === 'live')
      }
      return expanded.current.has(jobId)
    },
    [loadJob, source],
  )

  /** Demo buttons: POST /api/simulate/purchase for Mike. Returns the one-line result. */
  const buyAt = useCallback(
    async (merchant: 'Ferguson' | 'Home Depot'): Promise<string> => {
      if (source !== 'live') return 'Offline: the backend is unreachable, so no purchase was sent.'
      try {
        const res = await backend.purchase({ worker_id: DEMO_WORKER_ID, merchant_name: merchant, amount: DEMO_AMOUNT_USD })
        await reload()
        if (res.decline_reason === 'no_active_card') return `Declined at ${merchant}: Mike has no active card. Text a request first.`
        return res.message ?? `${res.result === 'approved' ? 'Approved' : 'Declined'} at ${merchant}.`
      } catch (err) {
        return err instanceof BackendUnavailableError ? 'Offline: the backend is unreachable.' : `Error: ${(err as Error).message}`
      }
    },
    [source, reload],
  )

  const status: 'live' | 'offline' | 'checking' =
    healthy === null || source === null ? 'checking' : healthy && source === 'live' ? 'live' : 'offline'

  return { data, source, status, jobDetails, toggleJob, buyAt }
}
