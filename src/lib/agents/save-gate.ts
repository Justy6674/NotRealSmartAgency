/**
 * Whether reviewed content may enter the outputs library.
 *
 * The library is not passive storage. `query_outputs` is given to every
 * department so past work can be read back as an example, which means anything
 * saved becomes something later work imitates. Content that failed a
 * regulatory review therefore cannot be written down for a regulated project:
 * it would return as a model to copy, and the original violation would spread.
 *
 * Kept beside the publishing gate, and shaped the same way, so the two
 * decisions stay recognisably one rule applied at two exits.
 */

import type { GuardianResult } from './compliance-filter'

export interface SaveGateResult {
  allowed: boolean
  reason: string | null
}

const ALLOWED: SaveGateResult = { allowed: true, reason: null }

/**
 * Decide whether a review permits saving.
 *
 * Call this only for a regulated project — an unregulated one has nothing to
 * check against and passes without a review at all.
 *
 * A missing review is a block, not a pass. The filter catches its own errors
 * and returns a result that reads as valid, so "no review" and "clean review"
 * are otherwise the same value.
 */
export function complianceGateForSave(result: GuardianResult | null): SaveGateResult {
  if (!result) {
    return {
      allowed: false,
      reason:
        'This project advertises a regulated health service and the review did not run, so nothing was saved. Try again shortly.',
    }
  }

  // A definite finding is reported ahead of an incomplete review: the local
  // rule checks run without a model and their findings are exact, so naming
  // them tells the caller what to actually change.
  if (!result.isValid) {
    const issues = [...result.flags, ...result.brandVoiceIssues]
    return {
      allowed: false,
      reason: `Not saved — the review found: ${issues.join('; ')}. Fix these and save again.`,
    }
  }

  if (!result.checkCompleted) {
    return {
      allowed: false,
      reason:
        'Not saved — the review did not finish, so this content is unverified. Try again shortly.',
    }
  }

  return ALLOWED
}
