import type { UomType } from './types'

function clamp(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function computeProgress(
  uomType: UomType,
  targetValue: number | null,
  actualValue: number | null,
  targetDate: string | null,
  completionDate?: string
) {
  if (uomType === 'timeline') {
    if (!targetDate || !completionDate) return 0
    const deadline = new Date(targetDate).getTime()
    const completed = new Date(completionDate).getTime()
    return completed <= deadline ? 100 : 0
  }

  if (uomType === 'zero') {
    if (actualValue == null) return 0
    return actualValue === 0 ? 100 : 0
  }

  if (targetValue == null || actualValue == null || targetValue === 0) return 0

  if (uomType === 'numeric_min' || uomType === 'percent_min') {
    return clamp((actualValue / targetValue) * 100)
  }

  return clamp((targetValue / actualValue) * 100)
}
