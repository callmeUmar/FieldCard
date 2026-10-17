import type { MerchantDocument } from '../types/contracts'

/** Canonical merchants (matches backend `merchants` collection shape). */
export const MERCHANTS: MerchantDocument[] = [
  {
    _id: 'merchant_ferguson',
    name: 'Ferguson Plumbing Supply',
    mcc: '5074',
  },
  {
    _id: 'merchant_home_depot',
    name: 'Home Depot Pro',
    mcc: '5200',
  },
  {
    _id: 'merchant_pacific',
    name: 'Pacific Plumbing Supply',
    mcc: '5074',
  },
  {
    _id: 'merchant_amazon',
    name: 'Amazon Business',
    mcc: '5399',
  },
]

export const MCC_HOME_IMPROVEMENT = '5200'
export const MCC_PLUMBING_SUPPLY = '5074'
export const MCC_HARDWARE = '5251'

/** MCCs allowed on standard job plumbing material cards (not Home Improvement). */
export const JOB_MATERIAL_MCCS = [MCC_PLUMBING_SUPPLY, MCC_HARDWARE]

export function merchantByName(name: string): MerchantDocument | undefined {
  return MERCHANTS.find((m) => m.name === name)
}

export function merchantByMcc(mcc: string): MerchantDocument | undefined {
  return MERCHANTS.find((m) => m.mcc === mcc)
}

export function mccDeclineReason(mcc: string, allowedMccs: string[]): string {
  return `MCC ${mcc} is not in allowed_mccs [${allowedMccs.join(', ')}]`
}
