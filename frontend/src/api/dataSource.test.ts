import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dashboardFixture } from './liveFixture'

type Call = { url: string; init?: RequestInit }
let calls: Call[]

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return handler(url, init)
  }))
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

async function freshApi() {
  vi.resetModules() // the data source remembers live/offline per module instance
  return (await import('./dataSource')).dashboardApi
}

beforeEach(() => vi.unstubAllEnvs())
afterEach(() => vi.unstubAllGlobals())

describe('dashboardApi', () => {
  it('uses the deployed backend by default', async () => {
    stubFetch(() => json(dashboardFixture()))
    const api = await freshApi()
    const snap = await api.getSnapshot()
    expect(snap.source).toBe('live')
    expect(calls[0].url).toBe('https://fieldcard.onrender.com/api/dashboard')
  })

  it('falls back to offline demo data when the backend is unreachable', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    const api = await freshApi()
    const snap = await api.getSnapshot()
    expect(snap.source).toBe('offline')
    expect(snap.jobs.length).toBeGreaterThan(0)
    expect(api.source).toBe('offline')
    expect(await api.getActivity()).toBeNull()
  })

  it('treats 5xx (e.g. database down) as unreachable', async () => {
    stubFetch(() => json({ detail: 'Database unreachable' }, 503))
    expect((await (await freshApi()).getSnapshot()).source).toBe('offline')
  })

  it('goes offline when the backend has no dashboard yet (404, e.g. not deployed or not seeded)', async () => {
    stubFetch(() => json({ detail: 'Not Found' }, 404))
    expect((await (await freshApi()).getSnapshot()).source).toBe('offline')
  })

  it('surfaces other 4xx errors instead of hiding them behind offline data', async () => {
    stubFetch(() => json({ detail: 'since must be an ISO timestamp' }, 400))
    await expect((await freshApi()).getSnapshot()).rejects.toThrow('since must be an ISO timestamp')
  })

  it('demo purchase buttons call POST /api/simulate/purchase with the backend store name', async () => {
    stubFetch((_url, init) =>
      init?.method === 'POST'
        ? json({ result: 'declined', decline_reason: 'this card only works at the approved store type', status: 'declined', reason: null, transaction_id: 'txn_no' })
        : json(dashboardFixture()),
    )
    const api = await freshApi()
    await api.getSnapshot()
    const res = await api.runLiveAgentPurchase('blocked')
    const post = calls.find((c) => c.init?.method === 'POST')!
    expect(post.url).toBe('https://fieldcard.onrender.com/api/simulate/purchase')
    expect(JSON.parse(String(post.init!.body))).toEqual({ worker_id: 'w_mike', merchant_name: 'Home Depot', amount: 89 })
    expect(res.transaction.status).toBe('declined')
    expect(res.transaction.declineReason).toBe('this card only works at the approved store type')
  })

  it('owner approvals are by SMS while live', async () => {
    stubFetch(() => json(dashboardFixture()))
    const api = await freshApi()
    await api.getSnapshot()
    await expect(api.approveTransaction('req_2')).rejects.toThrow(/SMS/)
  })

  it('reads the backend address from VITE_API_URL', async () => {
    vi.stubEnv('VITE_API_URL', 'https://staging.example.com/')
    stubFetch(() => json(dashboardFixture()))
    await (await freshApi()).getSnapshot()
    expect(calls[0].url).toBe('https://staging.example.com/api/dashboard')
  })
})
