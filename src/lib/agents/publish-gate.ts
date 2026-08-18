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

/**
 * ── What counts as "the content" ──────────────────────────────────────────
 *
 * THE FAULT: the gate reviewed the caption, the hashtags and the sign-off, and
 * nothing else — while the composer had grown six more fields that reach a live
 * account as readable words: `first_comment` (Instagram, Facebook, YouTube,
 * LinkedIn), `title` (Facebook, YouTube), `document_title` (LinkedIn) and
 * `thread_items` (X). On a thread the top-level content is display-only and is
 * NEVER published, so the reviewed text was the one piece of text that did not
 * go out. An owner could put a guaranteed-outcome claim in the first comment of
 * a Downscale post and it would reach Instagram unreviewed — up to $60,000 per
 * offence under AHPRA/TGA.
 *
 * The fix is deliberately NOT a list of those six names. Hand-listing is how
 * this happened: every field added to the composer since the gate was written
 * escaped it silently, because nothing anywhere said "and this one too". So the
 * rule is inverted — every string in the options object is treated as words
 * that go out, and only keys KNOWN to be machinery are dropped. A new composer
 * field is reviewed the day it is added, by nobody doing anything. Getting a
 * field wrongly reviewed costs a few tokens; getting one wrongly skipped is the
 * incident above.
 */

/**
 * Keys whose values are plumbing — ids, enums, switches, resource pointers —
 * not words a reader ever sees. Compared with punctuation and case stripped, so
 * `privacy_level`, `privacyLevel` and `PrivacyLevel` are one entry.
 *
 * Only add a key here when its value could never carry a claim. When in doubt,
 * leave it out: the safe direction is review.
 */
const NON_PROSE_KEYS = new Set([
  // Visibility / audience enums
  'privacy', 'privacylevel', 'privacystatus', 'visibility', 'status', 'poststatus',
  'replysettings', 'shareto', 'sharetofeed', 'audience',
  // Classification enums and taxonomy ids
  'category', 'categoryname', 'playlist', 'commercialcontent', 'commercialcontenttype',
  'type', 'posttype', 'contenttype', 'mediatype', 'filetype', 'mimetype', 'provider',
  'providers', 'platform', 'platforms', 'accounts', 'account', 'network', 'networks',
  // Destinations that are named containers, not prose
  'board', 'boardname', 'boards', 'workspace', 'profile', 'slug', 'uuid',
  // Handles and mentions — account names, not sentences
  'collaborators', 'collaborator',
  // Pointers to files rather than the words on them
  'thumbnail', 'thumbnails', 'cover', 'coverimage', 'poster', 'path', 'paths',
  // Scheduling and bookkeeping
  'schedule', 'scheduledat', 'createdat', 'updatedat', 'publishedat', 'date', 'time',
  'timezone', 'locale', 'lang', 'language', 'version', 'source', 'createdby', 'tags',
  // Credentials — never reviewed, never logged into a model prompt
  'key', 'keys', 'token', 'secret', 'password',
])

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** A key whose value is machinery. Everything else is treated as outbound words. */
export function isNonProseOptionKey(key: string): boolean {
  const k = normaliseKey(key)
  if (NON_PROSE_KEYS.has(k)) return true
  // Ids and links, however they are spelled: account_id, playlistId, mediaIds,
  // cover_image_url, videoCoverImageUrl, permalink.
  return k.endsWith('id') || k.endsWith('ids') || k.endsWith('url') || k.endsWith('urls')
    || k.endsWith('uri') || k.endsWith('link')
}

function humaniseKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
}

/** How deep a composer options object is ever walked. Guards a cyclic or absurd shape. */
const MAX_OPTION_DEPTH = 6

function collectProse(
  value: unknown,
  label: string,
  out: Array<{ label: string; text: string }>,
  seen: Set<string>,
  depth: number,
): void {
  if (depth > MAX_OPTION_DEPTH) return

  if (typeof value === 'string') {
    const text = value.trim()
    // Already reviewed as part of the caption, or blank. Booleans and numbers
    // fall through here on purpose: a switch carries no claim.
    if (text === '' || seen.has(text)) return
    seen.add(text)
    out.push({ label: label || 'extra text', text })
    return
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      collectProse(entry, `${label || 'item'} ${index + 1}`, out, seen, depth + 1)
    })
    return
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isNonProseOptionKey(key)) continue
      const next = label ? `${label} — ${humaniseKey(key)}` : humaniseKey(key)
      collectProse(child, next, out, seen, depth + 1)
    }
  }
}

/**
 * Every word this post puts in front of a reader, as one block for review.
 *
 * The caption first, exactly as it will be sent, then every other piece of
 * free text travelling with it — labelled, so a block message can name the
 * field the owner has to fix rather than quoting a sentence they cannot find.
 *
 * Callers pass the options object WHOLE. Picking fields out of it before
 * calling is the mistake this function exists to end.
 */
export function outboundTextForReview(input: {
  /** The caption exactly as the platform will receive it — sign-off included. */
  caption: string
  /** `scheduled_posts.metadata.platform_options`, unfiltered. */
  platformOptions?: Record<string, unknown> | null
  /** The request metadata, unfiltered — the Mixpost path reads `youtube_title` from it. */
  metadata?: Record<string, unknown> | null
}): string {
  const caption = input.caption ?? ''
  const parts: Array<{ label: string; text: string }> = []
  const seen = new Set<string>([caption.trim()])

  collectProse(input.platformOptions ?? null, '', parts, seen, 0)
  collectProse(input.metadata ?? null, '', parts, seen, 0)

  if (parts.length === 0) return caption

  const extras = parts.map((part) => `${part.label}: ${part.text}`).join('\n')
  return `${caption}\n\nAlso published with this post, and part of it for review:\n${extras}`
}
