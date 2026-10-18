import { JOB_MATERIAL_MCCS, mccDeclineReason } from '../data/merchants'
import type { VirtualCard } from '../types'

export function isMccAllowedOnCard(mcc: string, card: VirtualCard): boolean {
  return card.allowedMccs.includes(mcc)
}

export function isJobMaterialMcc(mcc: string): boolean {
  return JOB_MATERIAL_MCCS.includes(mcc)
}

export function evaluateMccForCard(
  mcc: string,
  card: VirtualCard | undefined,
): { passed: boolean; detail: string } {
  if (!card) {
    return {
      passed: isJobMaterialMcc(mcc),
      detail: isJobMaterialMcc(mcc)
        ? `MCC ${mcc} is a permitted materials category`
        : `MCC ${mcc} is not a permitted materials category`,
    }
  }

  const passed = isMccAllowedOnCard(mcc, card)
  return {
    passed,
    detail: passed
      ? `MCC ${mcc} is in allowed_mccs`
      : mccDeclineReason(mcc, card.allowedMccs),
  }
}
