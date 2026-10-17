import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fieldcardApi } from '../api/adapter'
import type {
  DashboardSnapshot,
  SimulatePurchaseInput,
  SimulatePurchaseResult,
} from '../types'

interface DashboardContextValue {
  data: DashboardSnapshot | null
  loading: boolean
  error: string | null
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

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const snap = await fieldcardApi.getSnapshot()
      setData(snap)
    } catch {
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => {
      void fieldcardApi.getSnapshot().then(setData)
    }, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  const approve = useCallback(async (transactionId: string) => {
    await fieldcardApi.approveTransaction(transactionId)
    await refresh()
  }, [refresh])

  const decline = useCallback(async (transactionId: string) => {
    await fieldcardApi.declineTransaction(transactionId)
    await refresh()
  }, [refresh])

  const simulate = useCallback(
    async (input: SimulatePurchaseInput) => {
      setSimulating(true)
      try {
        const result = await fieldcardApi.simulatePurchase(input)
        await refresh()
        return result
      } finally {
        setSimulating(false)
      }
    },
    [refresh],
  )

  const resetDemo = useCallback(async () => {
    await fieldcardApi.resetDemo()
    await refresh()
  }, [refresh])

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      refresh,
      approve,
      decline,
      simulate,
      simulating,
      resetDemo,
    }),
    [data, loading, error, refresh, approve, decline, simulate, simulating, resetDemo],
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
