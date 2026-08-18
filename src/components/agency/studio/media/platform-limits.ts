/**
 * What each platform will refuse, and how to say so in one sentence.
 *
 * ── The fault this file exists to keep closed ──────────────────────────
 * There used to be ONE table of byte ceilings, applied to every file whatever
 * it was, and the numbers in it were PICTURE ceilings. Held up against a video
 * they are wrong by two to four orders of magnitude: Instagram refuses a
 * picture over 8 MB and accepts a video up to 300 MB; Facebook refuses a
 * picture over 10 MB and accepts a video up to 4 GB. The result on screen was a
 * library of two hundred files where nearly every clip carried a red line, and
 * one 23.3 MB video was declared too large for ten platforms it is comfortably
 * fine on. A warning that is wrong that often is not a warning — it is noise a
 * person learns to scroll past, which is worse than saying nothing, because the
 * one true refusal is now hidden inside a wall of false ones.
 *
 * So: a file is judged against the ceiling for ITS OWN TYPE, and against the
 * platforms this business actually posts to. Nothing else is mentioned.
 *
 * ── Two sources, deliberately, answering different questions ───────────
 *   1. `PLATFORM_SIZE_CEILINGS` — a local table. It answers *instantly*,
 *      before a byte has left the machine, which is the only moment a person
 *      can still choose a different file cheaply. Every number in it was
 *      measured, not recalled — see the citation beside each row.
 *   2. `refusalsFromLiveLimits` — the same question asked of the publisher
 *      itself once the file has landed and has a URL. That call is the
 *      authority: it is the exact rule publishing applies, and it is
 *      type-aware, so when the two disagree the live answer wins and the table
 *      is stale. Callers say which one they used, the way the character counts
 *      already do, rather than presenting an estimate as a verdict.
 *
 * Neither one blocks an upload. The library is ours and keeps whatever it is
 * given — a file Bluesky refuses is still a perfectly good file for Facebook.
 * What is not acceptable is silence: a picture over the line used to sail
 * through the library, get chosen, get written about, get scheduled, and fail
 * at the appointed hour with a message about bytes.
 *
 * X is absent on purpose. The owner does not use it, so naming it in a refusal
 * would be advice about a platform he will never post to.
 */

import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'

/** Platforms the owner does not publish to. Their limits are noise, not news. */
const NOT_OUR_PLATFORMS = new Set(['twitter', 'x'])

/** Which kind of ceiling applies. A file we cannot classify gets neither. */
export type MediaKind = 'picture' | 'video' | 'unknown'

export interface PlatformCeiling {
  /** The publisher's own key, so a live answer can be matched to this row. */
  key: string
  label: string
  /** Bytes a picture may be. `null` where the platform takes no picture. */
  picture: number | null
  /** Bytes a video may be. `null` where no ceiling is known — see below. */
  video: number | null
}

/**
 * The size each platform stops accepting a file at, in bytes, per type.
 *
 * MEASURED, NOT RECALLED. Every picture number and every video number below
 * came back from the publisher's own media validator on **2026-08-19** — one
 * real picture and three real videos pushed through `validateMedia`, whose
 * answers are the rules the send itself applies. The picture column and the
 * video column are genuinely different tables at the far end, which is the
 * whole point: asking about a video used to get the picture answer.
 *
 * Google Business is the one row the publisher does not answer for video — it
 * is simply absent from a video response — so its video ceiling comes from
 * Google's own documentation instead ("Videos: up to 75 MB",
 * support.google.com/business/answer/6103862, read 2026-08-19). Its picture
 * ceiling matches the publisher's exactly, which is some comfort that the two
 * sources are describing the same platform.
 *
 * A `null` means "we do not know of a ceiling" and is never a refusal. Guessing
 * one would put us straight back where this file started.
 */
export const PLATFORM_SIZE_CEILINGS: readonly PlatformCeiling[] = [
  // picture + video: publisher validateMedia, 2026-08-19
  { key: 'bluesky', label: 'Bluesky', picture: 1_000_000, video: 52_428_800 },
  // picture: publisher validateMedia + support.google.com/business/answer/6103862, both 5 MB, 2026-08-19
  // video: Google's own docs, 75 MB — the publisher reports no video ceiling for this one
  { key: 'googlebusiness', label: 'Google Business Profile', picture: 5_242_880, video: 78_643_200 },
  { key: 'instagram', label: 'Instagram', picture: 8_388_608, video: 314_572_800 },
  { key: 'threads', label: 'Threads', picture: 8_388_608, video: 1_073_741_824 },
  { key: 'linkedin', label: 'LinkedIn', picture: 8_388_608, video: 5_368_709_120 },
  { key: 'facebook', label: 'Facebook', picture: 10_485_760, video: 4_294_967_296 },
  { key: 'telegram', label: 'Telegram', picture: 10_485_760, video: 52_428_800 },
  { key: 'tiktok', label: 'TikTok', picture: 20_971_520, video: 4_294_967_296 },
  { key: 'reddit', label: 'Reddit', picture: 20_971_520, video: 1_073_741_824 },
  { key: 'snapchat', label: 'Snapchat', picture: 20_971_520, video: 524_288_000 },
  { key: 'discord', label: 'Discord', picture: 26_214_400, video: 26_214_400 },
  { key: 'pinterest', label: 'Pinterest', picture: 33_554_432, video: 2_147_483_648 },
  // YouTube appears only in a video answer, never a picture one.
  { key: 'youtube', label: 'YouTube', picture: null, video: 274_877_906_944 },
]

/** Owner-facing names for the keys the live validator answers with. */
const LIVE_LABELS: Record<string, string> = {
  ...Object.fromEntries(PLATFORM_SIZE_CEILINGS.map((p) => [p.key, p.label])),
  google_business: 'Google Business Profile',
  googlebusinessprofile: 'Google Business Profile',
  mastodon: 'Mastodon',
  pixelfed: 'Pixelfed',
}

/** The publisher, Mixpost and Google all spell this one differently. */
function ceilingKeyFor(platform: string): string {
  const key = canonicalSocialPlatform(platform)
  if (key === 'google_business' || key === 'googlebusinessprofile' || key === 'gmb') {
    return 'googlebusiness'
  }
  return key
}

/** "video" / "picture" / "file" — the word the owner would use for it. */
export function ownerWordFor(fileType: string | null | undefined): 'video' | 'picture' | 'file' {
  const type = (fileType ?? '').toLowerCase()
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('image/')) return 'picture'
  return 'file'
}

/** Which column of the table applies to this file. */
export function mediaKindFor(fileType: string | null | undefined): MediaKind {
  const word = ownerWordFor(fileType)
  return word === 'file' ? 'unknown' : word
}

/**
 * The ceiling that applies to one platform for one kind of file.
 *
 * An unclassified file is judged against the LARGER of the two, so the only
 * thing we will say about it is a refusal that holds whichever it turns out to
 * be. Being quiet about a file we cannot identify is the right failure: the
 * alternative is the picture ceiling applied to a video all over again.
 */
function ceilingFor(platform: PlatformCeiling, kind: MediaKind): number | null {
  if (kind === 'picture') return platform.picture
  if (kind === 'video') return platform.video
  const known = [platform.picture, platform.video].filter((n): n is number => n !== null)
  return known.length === 0 ? null : Math.max(...known)
}

export interface RefusalScope {
  /** The file's MIME type. Without it, only a certain refusal is reported. */
  fileType?: string | null
  /**
   * The platforms this business actually posts from, in whatever spelling the
   * accounts came back in. Omit when they are not known and the answer is
   * unscoped; pass an empty list and nothing is reported at all, which is
   * correct — a business with no accounts connected cannot be refused by one.
   */
  connected?: readonly string[] | null
}

function connectedKeys(scope: RefusalScope | undefined): Set<string> | null {
  if (!scope || scope.connected === undefined || scope.connected === null) return null
  return new Set(scope.connected.map(ceilingKeyFor).filter(Boolean))
}

/**
 * Which platforms will refuse a file this size, smallest ceiling first.
 *
 * Returns an empty list for anything under every ceiling that applies, so the
 * caller can render nothing at all rather than "0 platforms affected".
 */
export function platformsThatWillRefuse(bytes: number, scope?: RefusalScope): string[] {
  if (!Number.isFinite(bytes) || bytes <= 0) return []
  const kind = mediaKindFor(scope?.fileType)
  const only = connectedKeys(scope)

  return PLATFORM_SIZE_CEILINGS
    .filter((platform) => !NOT_OUR_PLATFORMS.has(platform.key))
    .filter((platform) => !only || only.has(platform.key))
    .flatMap((platform) => {
      const ceiling = ceilingFor(platform, kind)
      if (ceiling === null || bytes <= ceiling) return []
      return [{ label: platform.label, ceiling }]
    })
    .sort((a, b) => a.ceiling - b.ceiling)
    .map((entry) => entry.label)
}

export interface LiveMediaLimit {
  limit: number
  limitFormatted: string
  withinLimit: boolean
}

/**
 * The same list, taken from the publisher's own answer for one file.
 *
 * This answer is already type-aware — the same call on a picture and on a video
 * returns two completely different sets of ceilings — so nothing here needs to
 * know which kind of file it was.
 *
 * Unknown keys are kept and title-cased rather than dropped: a platform the
 * publisher adds next month should still be named, and a silent omission here
 * would read on screen as "everything is fine". When the caller knows which
 * accounts the business has, that scoping wins over this generosity — a
 * platform he cannot post to has no news to give him.
 */
export function refusalsFromLiveLimits(
  limits: Record<string, LiveMediaLimit> | null | undefined,
  scope?: RefusalScope,
): string[] {
  if (!limits) return []
  const only = connectedKeys(scope)

  return Object.entries(limits)
    .filter(([key, entry]) => {
      if (NOT_OUR_PLATFORMS.has(key.toLowerCase())) return false
      if (only && !only.has(ceilingKeyFor(key))) return false
      return entry && !entry.withinLimit
    })
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

/**
 * The whole warning, in one sentence, or null when there is nothing to say.
 *
 * Written the way it would be said out loud — no byte counts in the lead, no
 * platform jargon, and always an action. "Too large" on its own leaves a person
 * staring at a file with nothing to do about it. An empty refusal list returns
 * null rather than a reassurance: a green tick on every one of two hundred
 * files is the same wall of noise as a red one.
 */
export function tooLargeSentence(input: {
  fileType?: string | null
  refusedBy: string[]
}): string | null {
  if (input.refusedBy.length === 0) return null
  const word = ownerWordFor(input.fileType)
  return `This ${word} is too large for ${nameList(input.refusedBy)} — trim it or pick another.`
}
