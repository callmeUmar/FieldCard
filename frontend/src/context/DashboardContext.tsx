import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ACTIVITY_POLL_MS, OFFLINE_RETRY_MS } from '../api/config'
import { dashboardApi } from '../api/dataSource'
import type {
  DashboardSnapshot,
  DataSource,
  SimulatePurchaseInput,
  SimulatePurchaseResult,
} from '../types'

interface DashboardContextValue {
  data: DashboardSnapshot | null
  loading: boolean
  error: string | null
  /** 'live' = deployed backend, 'offline' = bundled demo data (backend unreachable) */
  source: DataSource
  refresh: () => Promise<void>
  approve: (transactionId: string) => Promise<void>
  decline: (transactionId: string) => Promise<void>
  simulate: (input: SimulatePurchaseInput) => Promise<SimulatePurchaseResult | undefined>
  simulating: boolean
  resetDemo: () => Promise<void>
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [simulating, setSimulating] = useState(false)
  const newestActivity = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const snap = await dashboardApi.getSnapshot()
      newestActivity.current = snap.activities[0]?.id ?? null
      setData(snap)
    } catch {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  const source: DataSource = data?.source ?? 'live'

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Live: poll the activity feed every 2s; a new event means other records changed too.
  // Offline: keep retrying the backend (e.g. while Render wakes from a cold start).
  useEffect(() => {
    if (loading) return
    let stopped = false
    let busy = false
    const tick = async () => {
      if (busy || stopped) return
      busy = true
      try {
        if (source === 'offline') {
          await refresh()
          return
        }
        const activities = await dashboardApi.getActivity()
        if (!activities || stopped) return
        if ((activities[0]?.id ?? null) !== newestActivity.current) {
          await refresh()
        } else {
          setData((d) => (d ? { ...d, activities } : d))
        }
      } catch {
        await refresh() // falls back to offline data if the backend went away
      } finally {
        busy = false
      }
    }
    const interval = setInterval(() => void tick(), source === 'offline' ? OFFLINE_RETRY_MS : ACTIVITY_POLL_MS)
    return () => {
      stopped = true
      clearInterval(interval)
    }
  }, [loading, source, refresh])

  const approve = useCallback(async (transactionId: string) => {
    await dashboardApi.approveTransaction(transactionId)
    await refresh()
  }, [refresh])

  const decline = useCallback(async (transactionId: string) => {
    await dashboardApi.declineTransaction(transactionId)
    await refresh()
  }, [refresh])

  const simulate = useCallback(
    async (input: SimulatePurchaseInput) => {
      setSimulating(true)
      try {
        const result = await dashboardApi.simulatePurchase(input)
        await refresh()
        return result
      } finally {
        setSimulating(false)
      }
    },
    [refresh],
  )

  const resetDemo = useCallback(async () => {
    await dashboardApi.resetDemo()
    await refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      source,
      refresh,
      approve,
      decline,
      simulate,
      simulating,
      resetDemo,
    }),
    [data, loading, error, source, refresh, approve, decline, simulate, simulating, resetDemo],
  )

  return (
    <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
  )
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider')
  return ctx
}
