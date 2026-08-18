/**
 * The shared Zernio vocabulary — one place that says what a platform, a media
 * item, a post target and a post status ARE.
 *
 * Depended on by every other file in `src/lib/zernio`, by
 * `src/lib/publishers/dispatcher.ts`, and (from here on) by every Social
 * department route, component and agent tool. Nothing outside this directory
 * should re-declare a Zernio literal union: two copies of a fifteen-member
 * platform list is how one of them quietly loses `threads`.
 *
 * Every literal here was read out of
 * `node_modules/@zernio/node/dist/index.d.ts` (0.2.587), not recalled. When the
 * SDK is bumped, re-read it — a platform name written from memory is the same
 * class of fault as a model id written from memory.
 *
 * Australian English throughout, including in anything a person can read.
 */

/* ── Platforms ─────────────────────────────────────────────────────────── */

/** Every platform `platforms[].platform` accepts on createPost/validatePost. */
export const ZERNIO_PLATFORMS = [
  'twitter',
  'instagram',
  'tiktok',
  'youtube',
  'facebook',
  'linkedin',
  'bluesky',
  'threads',
  'reddit',
  'pinterest',
  'telegram',
  'snapchat',
  'googlebusiness',
  'discord',
  'slack',
] as const

export type ZernioPlatform = (typeof ZERNIO_PLATFORMS)[number]

export function isZernioPlatform(value: unknown): value is ZernioPlatform {
  return typeof value === 'string' && (ZERNIO_PLATFORMS as readonly string[]).includes(value)
}

/**
 * The ten platforms `unpublishPost` can remove a LIVE post from.
 *
 * This is the takedown list. For the four brands advertising regulated health
 * services it is the only way NRS can pull a published post off a platform, so
 * it is a compliance capability, not a convenience — see `posts.ts`.
 */
export const ZERNIO_UNPUBLISH_PLATFORMS = [
  'threads',
  'facebook',
  'twitter',
  'linkedin',
  'youtube',
  'pinterest',
  'reddit',
  'bluesky',
  'googlebusiness',
  'telegram',
] as const

export type ZernioUnpublishPlatform = (typeof ZERNIO_UNPUBLISH_PLATFORMS)[number]

export function isZernioUnpublishPlatform(value: unknown): value is ZernioUnpublishPlatform {
  return typeof value === 'string' && (ZERNIO_UNPUBLISH_PLATFORMS as readonly string[]).includes(value)
}

/** The four platforms whose published text can be edited in place. */
export const ZERNIO_EDITABLE_PLATFORMS = ['twitter', 'discord', 'facebook', 'reddit'] as const

export type ZernioEditablePlatform = (typeof ZERNIO_EDITABLE_PLATFORMS)[number]

export function isZernioEditablePlatform(value: unknown): value is ZernioEditablePlatform {
  return typeof value === 'string' && (ZERNIO_EDITABLE_PLATFORMS as readonly string[]).includes(value)
}

/* ── Media ─────────────────────────────────────────────────────────────── */

/**
 * The closed MIME enum `getMediaPresignedUrl` accepts. Anything else is a 400,
 * so `media.ts` maps to this set rather than passing a browser's mime through.
 */
export const ZERNIO_MEDIA_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  'video/avi',
  'video/x-msvideo',
  'video/webm',
  'video/x-m4v',
  'application/pdf',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
] as const

export type ZernioMediaContentType = (typeof ZERNIO_MEDIA_CONTENT_TYPES)[number]

/**
 * One attachment as Zernio wants it.
 *
 * `altText` is the accessibility string, honoured on Instagram feed images,
 * Facebook, Threads, X (max 1000), LinkedIn, Bluesky and Pinterest (max 500),
 * ignored elsewhere. `thumbnail` is the Facebook/LinkedIn video cover;
 * `instagramThumbnail` is the Reel cover and wins over the platform-data
 * equivalents. NRS captured alt text in the composer for months and dropped it
 * on the floor at the wire — the field exists here so that cannot recur.
 */
export interface ZernioMediaItem {
  type?: 'image' | 'video' | 'gif' | 'document'
  url: string
  title?: string
  altText?: string
  filename?: string
  size?: number
  mimeType?: string
  thumbnail?: string
  instagramThumbnail?: string
}

/* ── Post targets ──────────────────────────────────────────────────────── */

/**
 * One account on one post — the shape that makes per-account versions real.
 *
 * `customContent` replaces the top-level content for THIS target only, which is
 * how two Instagram accounts on one post can carry different words and how a
 * 300-character caption survives on Bluesky next to X. `customMedia` swaps the
 * attachments for this target. `scheduledFor` staggers one target away from the
 * others. NRS sent none of these until 2026-08-18; per-platform variants only
 * survived because we wrote one `scheduled_posts` row per platform.
 */
export interface ZernioPlatformTarget {
  platform: string
  accountId: string
  customContent?: string
  customMedia?: ZernioMediaItem[]
  scheduledFor?: string
  platformSpecificData?: Record<string, unknown>
}

/* ── Posts ─────────────────────────────────────────────────────────────── */

/**
 * Which collection to read.
 *
 * `zernio` is posts we authored through the publisher. `external` is history
 * synced from the platform. The API defaults to `zernio`, and on a live brand
 * with 210 published posts that default returns ZERO rows — which is why every
 * wrapper in `posts.ts` refuses to guess and makes the caller say which.
 */
export type ZernioPostSource = 'zernio' | 'external'

/** Confirmed enum on `Post.status`. `partial` and `publishing` are real. */
export const ZERNIO_POST_STATUSES = [
  'draft',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'partial',
] as const

export type ZernioPostStatus = (typeof ZERNIO_POST_STATUSES)[number]

/** The four statuses `listPosts({status})` filters on — not the full six. */
export type ZernioPostStatusFilter = 'draft' | 'scheduled' | 'published' | 'failed'

export type ZernioPostSort =
  | 'scheduled-desc'
  | 'scheduled-asc'
  | 'created-desc'
  | 'created-asc'
  | 'status'
  | 'platform'

export interface ZernioPagination {
  page: number
  limit: number
  total: number
  pages: number
}

/* ── Ids ───────────────────────────────────────────────────────────────── */

/**
 * Read an id off a Zernio record, accepting both shapes.
 *
 * Mongo-backed resources (accounts, posts, profiles, queues, webhooks) carry
 * `_id`; the inbox and contacts projections carry `id`. A populated reference
 * arrives as an object rather than a string. Picking one and hoping is exactly
 * how the publish cron matched no Zernio account at all for weeks.
 */
export function zernioIdOf(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const rec = value as Record<string, unknown>
  const id = rec.id ?? rec._id
  return typeof id === 'string' ? id.trim() : ''
}

/* ── Account health ────────────────────────────────────────────────────── */

export interface ZernioAccountHealth {
  accountId: string
  platform: string
  username?: string
  displayName?: string
  profileId?: string
  status: 'healthy' | 'warning' | 'error'
  canPost: boolean
  canFetchAnalytics: boolean
  tokenValid: boolean
  tokenExpiresAt?: string
  needsReconnect: boolean
  issues: string[]
}

export interface ZernioAccountsHealth {
  summary: {
    total: number
    healthy: number
    warning: number
    error: number
    needsReconnect: number
  }
  accounts: ZernioAccountHealth[]
}

/* ── Queue ─────────────────────────────────────────────────────────────── */

/** `dayOfWeek` is 0=Sunday..6=Saturday. `time` is 24-hour `HH:mm`. */
export interface ZernioQueueSlot {
  dayOfWeek: number
  time: string
}

export interface ZernioQueueSchedule {
  queueId: string
  name: string
  /** IANA zone, e.g. `Australia/Brisbane`. */
  timezone: string
  active: boolean
  isDefault: boolean
  slots: ZernioQueueSlot[]
}

export interface ZernioQueueView {
  /** False means this profile has no posting schedule yet — greenfield. */
  exists: boolean
  schedules: ZernioQueueSchedule[]
  /** Upcoming free times, for display. Never copy one into `scheduledFor`. */
  nextSlots: string[]
}

/* ── Validation ────────────────────────────────────────────────────────── */

export interface ZernioValidationIssue {
  platform: string
  message: string
}

export interface ZernioValidation {
  valid: boolean
  errors: ZernioValidationIssue[]
  warnings: ZernioValidationIssue[]
}

export interface ZernioLengthCheck {
  count: number
  limit: number
  valid: boolean
}

/** Keyed by Zernio's own target names, including `twitterPremium`. */
export type ZernioLengthReport = Record<string, ZernioLengthCheck>

export interface ZernioMediaLimit {
  limit: number
  limitFormatted: string
  withinLimit: boolean
}

export interface ZernioMediaValidation {
  valid: boolean
  url: string
  error?: string
  contentType?: string
  size?: number
  sizeFormatted?: string
  type?: 'image' | 'video' | 'unknown'
  platformLimits: Record<string, ZernioMediaLimit>
}

/* ── Outbound approval ─────────────────────────────────────────────────── */

/**
 * Proof that words about to reach a real audience passed the regulatory review.
 *
 * Four brands advertise regulated health services. A reply to a comment, a
 * review or a DM is published copy in every sense that matters to AHPRA and the
 * TGA, and none of those paths went through `publish-gate.ts` before — they did
 * not exist. Rather than trust every future caller to remember, the outbound
 * wrappers in `engagement.ts` and `posts.ts` take one of these, and the only
 * honest way to make one is `approvedByPublishGate()` with a real gate result.
 *
 * Writing the literal by hand is possible, as it is in any language. It is also
 * unmistakably a decision to bypass the review rather than an omission, which
 * is the whole point.
 */
export interface ZernioOutboundApproval {
  readonly checkedWith: 'publish-gate'
  readonly allowed: true
  /** What was reviewed, for the audit line. */
  readonly label: string
}

/**
 * Turn a `checkPublishAllowed()` result into an approval, or throw.
 *
 * Throwing rather than returning null is deliberate: a caller that ignores a
 * blocked verdict and sends anyway is the failure this exists to prevent, and a
 * nullable return is easy to ignore.
 */
export function approvedByPublishGate(
  gate: { allowed: boolean; reason: string | null },
  label: string,
): ZernioOutboundApproval {
  if (!gate.allowed) {
    throw new Error(gate.reason ?? 'The regulatory review stopped this reply.')
  }
  return { checkedWith: 'publish-gate', allowed: true, label }
}
