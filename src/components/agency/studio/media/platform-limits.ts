/**
 * What each platform will refuse, and how to say so in one sentence.
 *
 * Two sources, deliberately, and they answer different questions:
 *
 *   1. `PLATFORM_SIZE_CEILINGS` — a local table, read from the publisher's own
 *      media validator on 2026-08-18. It answers *instantly*, before a single
 *      byte has left the machine, which is the only moment a person can still
 *      choose a different file cheaply.
 *   2. `refusalsFromLiveLimits` — the same question asked of the publisher
 *      itself once the file has landed and has a URL (`validateZernioMedia`).
 *      That call is the authority: it is the exact rule publishing applies, so
 *      when the two disagree the live answer wins and the table is stale.
 *
 * Neither one blocks an upload. The library is ours and keeps whatever it is
 * given — a file that Bluesky refuses is still a perfectly good file for
 * Facebook. What is not acceptable is silence: a picture that is over the line
 * used to sail through the library, get chosen, get written about, get
 * scheduled, and fail at the appointed hour with a message about bytes.
 *
 * X is absent from both lists on purpose. The owner does not use it, so naming
 * it in a refusal would be advice about a platform he will never post to.
 */

/** Platforms the owner does not publish to. Their limits are noise, not news. */
const NOT_OUR_PLATFORMS = new Set(['twitter', 'x'])

export interface PlatformCeiling {
  /** The publisher's own key, so a live answer can be matched to this row. */
  key: string
  label: string
  bytes: number
}

/**
 * The size each platform stops accepting a file at, in bytes.
 *
 * Bluesky 1 MB, Google Business 5 MB, Instagram/Threads/LinkedIn 8 MB,
 * Facebook/Telegram 10 MB, TikTok/Reddit/Snapchat 20 MB, Discord 26 MB,
 * Pinterest 33.5 MB. Ordered smallest first so a refusal list reads worst-first.
 */
export const PLATFORM_SIZE_CEILINGS: readonly PlatformCeiling[] = [
  { key: 'bluesky', label: 'Bluesky', bytes: 1_000_000 },
  { key: 'googlebusiness', label: 'Google Business Profile', bytes: 5_000_000 },
  { key: 'instagram', label: 'Instagram', bytes: 8_000_000 },
  { key: 'threads', label: 'Threads', bytes: 8_000_000 },
  { key: 'linkedin', label: 'LinkedIn', bytes: 8_000_000 },
  { key: 'facebook', label: 'Facebook', bytes: 10_000_000 },
  { key: 'telegram', label: 'Telegram', bytes: 10_000_000 },
  { key: 'tiktok', label: 'TikTok', bytes: 20_000_000 },
  { key: 'reddit', label: 'Reddit', bytes: 20_000_000 },
  { key: 'snapchat', label: 'Snapchat', bytes: 20_000_000 },
  { key: 'discord', label: 'Discord', bytes: 26_000_000 },
  { key: 'pinterest', label: 'Pinterest', bytes: 33_500_000 },
]

/** Owner-facing names for the keys the live validator answers with. */
const LIVE_LABELS: Record<string, string> = {
  ...Object.fromEntries(PLATFORM_SIZE_CEILINGS.map((p) => [p.key, p.label])),
  google_business: 'Google Business Profile',
  googlebusinessprofile: 'Google Business Profile',
  mastodon: 'Mastodon',
  youtube: 'YouTube',
  pixelfed: 'Pixelfed',
}

/**
 * Which platforms will refuse a file this size, smallest ceiling first.
 *
 * Returns an empty list for anything under every ceiling, so the caller can
 * render nothing at all rather than "0 platforms affected".
 */
export function platformsThatWillRefuse(bytes: number): string[] {
  if (!Number.isFinite(bytes) || bytes <= 0) return []
  return PLATFORM_SIZE_CEILINGS.filter((p) => bytes > p.bytes).map((p) => p.label)
}

export interface LiveMediaLimit {
  limit: number
  limitFormatted: string
  withinLimit: boolean
}

/**
 * The same list, taken from the publisher's own answer for one file.
 *
 * Unknown keys are kept and title-cased rather than dropped: a platform the
 * publisher adds next month should still be named, and a silent omission here
 * would read on screen as "everything is fine".
 */
export function refusalsFromLiveLimits(
  limits: Record<string, LiveMediaLimit> | null | undefined,
): string[] {
  if (!limits) return []
  return Object.entries(limits)
    .filter(([key, entry]) => !NOT_OUR_PLATFORMS.has(key.toLowerCase()) && entry && !entry.withinLimit)
    .sort((a, b) => (a[1].limit || 0) - (b[1].limit || 0))
    .map(([key]) => LIVE_LABELS[key.toLowerCase()] ?? key.charAt(0).toUpperCase() + key.slice(1))
}

/** "Instagram", "Instagram and Threads", "Instagram, Threads and LinkedIn". */
export function nameList(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/** "video" / "picture" / "file" — the word the owner would use for it. */
export function ownerWordFor(fileType: string | null | undefined): 'video' | 'picture' | 'file' {
  const type = (fileType ?? '').toLowerCase()
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('image/')) return 'picture'
  return 'file'
}

/**
 * The whole warning, in one sentence, or null when there is nothing to say.
 *
 * Written the way it would be said out loud — no byte counts in the lead, no
 * platform jargon, and always an action. "Too large" on its own leaves a person
 * staring at a file with nothing to do about it.
 */
export function tooLargeSentence(input: {
  fileType?: string | null
  refusedBy: string[]
}): string | null {
  if (input.refusedBy.length === 0) return null
  const word = ownerWordFor(input.fileType)
  return `This ${word} is too large for ${nameList(input.refusedBy)} — trim it or pick another.`
}
