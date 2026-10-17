import { describe, expect, it } from 'vitest'
import { MERCHANTS, MCC_HOME_IMPROVEMENT } from './merchants'

describe('merchants seed', () => {
  it('includes Home Depot Pro with MCC 5200', () => {
    const hd = MERCHANTS.find((m) => m._id === 'merchant_home_depot')
    expect(hd?.name).toBe('Home Depot Pro')
    expect(hd?.mcc).toBe(MCC_HOME_IMPROVEMENT)
    expect(hd?.mcc).toBe('5200')
  })
})
