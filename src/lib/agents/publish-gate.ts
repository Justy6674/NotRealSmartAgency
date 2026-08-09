/**
 * The single regulatory gate every publishing path must pass through.
 *
 * Compliance was previously enforced in one place only — the Mixpost agent tool
 * — while the scheduled publisher and the direct platform publishers had no
 * check at all. That left two ways to reach a live account without a review:
 * schedule a post, or publish direct. Four of the eleven active projects
 * advertise regulated health services, where an unreviewed claim carries a
 * penalty of up to $60,000 per offence.
 *
 * Keeping the decision here, rather than repeating it per publisher, means a
 * new publishing route cannot quietly ship without one.
 */

import { runComplianceFilter } from './compliance-filter'
import type { ComplianceFlags, BrandDNAConstraints } from '@/types/database'
import { validateScentSellProductClaims } from '@/lib/products/scent-sell-product-gate'

export interface PublishGateResult {
  /** False means do not publish. Always check this before calling a platform. */
  allowed: boolean
  /** Present when blocked — safe to show the user and to store on the row. */
  reason: string | null
  /** Non-blocking notes worth logging. */
  warnings: string[]
}

const ALLOWED: PublishGateResult = { allowed: true, reason: null, warnings: [] }

function regimeOf(flags: ComplianceFlags): string {
  return [flags.ahpra ? 'AHPRA' : null, flags.tga ? 'TGA' : null].filter(Boolean).join('/')
}

/**
 * Decide whether content may be published for a project.
 *
 * Unregulated projects pass straight through after deterministic product-name
 * protection. The check exists for health advertising, and it does not run an
 * LLM over ordinary fragrance captions.
 *
 * For a regulated project this fails closed in both directions: a review that
 * found violations blocks, and a review that could not run also blocks. The
 * second case is the one that matters, because the filter catches its own
 * errors and returns a default-valid result, so a model outage is otherwise
 * indistinguishable from a clean pass.
 */
export async function checkPublishAllowed(input: {
  content: string
  complianceFlags: ComplianceFlags | null | undefined
  /** Required for the ScentSell catalogue gate; other brands pass through. */
  brandSlug?: string | null
  brandDNA?: BrandDNAConstraints | null
  /** Included in the block message so the operator knows which post stopped. */
  label?: string
}): Promise<PublishGateResult> {
  const flags = input.complianceFlags ?? { ahpra: false, tga: false, tga_categories: [] }

  const productGate = await validateScentSellProductClaims(input.brandSlug ?? '', input.content)
  if (!productGate.allowed) {
    return {
      allowed: false,
      reason: productGate.reason ?? 'Product identity could not be verified. Not published.',
      warnings: [],
    }
  }

  if (!flags.ahpra && !flags.tga) return ALLOWED

  const where = input.label ? ` (${input.label})` : ''
  const regime = regimeOf(flags)

  let check
  try {
    check = await runComplianceFilter(input.content, flags, input.brandDNA ?? undefined)
  } catch (error) {
    // The filter swallows its own failures, so reaching here means something
    // more fundamental broke. Still a block: regulated content is never
    // published on an absent review.
    return {
      allowed: false,
      reason: `${regime} review could not run${where}: ${error instanceof Error ? error.message : 'unknown error'}. Not published.`,
      warnings: [],
    }
  }

  // A violation is reported before an incomplete review. Both block, but the
  // local rule checks run without the model and their findings are definite —
  // saying "the review did not complete" would hide a banned word the caller
  // could actually fix.
  if (!check.isValid) {
    const issues = [...check.flags, ...check.brandVoiceIssues]
    return {
      allowed: false,
      reason: `${regime} review blocked this content${where}: ${issues.join('; ')}`,
      warnings: check.warnings,
    }
  }

  if (!check.checkCompleted) {
    return {
      allowed: false,
      reason: `${regime} review did not complete${where}. The content is unverified, so it was not published. Try again shortly.`,
      warnings: check.warnings,
    }
  }

  return { allowed: true, reason: null, warnings: check.warnings }
}
