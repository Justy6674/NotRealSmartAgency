/**
 * The health rules a clinic owner would say out loud, shown only when the
 * business is regulated. The ticks come from the NRS compliance review
 * (AbeAI corpus when grounded, local filter/gates always). Failed copy never
 * enters the library — this list is the handover, not a second publisher.
 */

export interface HealthFlags {
  ahpra?: boolean
  tga?: boolean
}

export interface HealthReview {
  isValid: boolean
  checkCompleted: boolean
}

export interface HealthChecklistItem {
  id: string
  label: string
  passed: boolean
}

export function isRegulatedHealth(flags: HealthFlags | null | undefined): boolean {
  return Boolean(flags?.ahpra || flags?.tga)
}

export function healthChecklist(
  flags: HealthFlags,
  review: HealthReview | null,
): HealthChecklistItem[] {
  if (!isRegulatedHealth(flags)) return []

  const passed = Boolean(review?.isValid && review?.checkCompleted)
  const items: HealthChecklistItem[] = []

  if (flags.ahpra) {
    items.push({ id: 'results', label: 'No promises about results', passed })
    items.push({ id: 'stories', label: 'No patient stories', passed })
    items.push({ id: 'beforeafter', label: 'No before-and-after photos', passed })
  }
  if (flags.tga) {
    items.push({ id: 'medicine', label: 'No prescription medicine names', passed })
  }

  return items
}
