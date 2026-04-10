/**
 * Design tokens for the Mixpost UI port.
 *
 * These are the *values* we observed in Mixpost Pro's resources/css/custom.css
 * and Tailwind theme (read via SSH against /var/www/html/vendor/inovector/
 * mixpost-pro-team on the VPS), reimplemented as TypeScript constants.
 *
 * Mixpost Pro is commercial — this file is NOT copied source code. Every
 * constant here is a re-implementation of the design decision, not the code.
 * Platform brand colours are public knowledge (the platforms publish them
 * as brand guidelines).
 *
 * Used by:
 * - Calendar phase 1 — CalendarPostPill platform accent + status chip
 * - Posts Index phase 4a — PostsTable row badges
 * - Review phase 4b — DraftCard + Post Activity items
 * - Analytics phase 5 — Chart.js platform colour mapping
 * - Composer phase 3 — PlatformCharacterRing + ProviderGallery
 */

// ── Platform brand colours ──────────────────────────────────────────────────

export const PLATFORM_BRAND_COLOURS = {
  facebook: '#1877f2',
  instagram: '#e4405f',
  twitter: '#000000',
  threads: '#000000',
  linkedin: '#0a66c2',
  tiktok: '#000000',
  mastodon: '#6364ff',
  youtube: '#ff0000',
  pinterest: '#bd081c',
  bluesky: '#0285ff',
} as const satisfies Record<string, `#${string}`>

export type PlatformKey = keyof typeof PLATFORM_BRAND_COLOURS

/** Short display label matching Mixpost's inline chips. */
export const PLATFORM_LABELS: Record<PlatformKey, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X',
  threads: 'Threads',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  mastodon: 'Mastodon',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
}

// ── Post status colours (light-mode defaults, dark mode auto-inverts) ───────

/** NRS uses oklch across its design system. These status pills match the
 *  feel of Mixpost's Badge states without copying their exact palette —
 *  tuned to sit naturally alongside the existing NRS oklch tokens in
 *  globals.css. */
export const POST_STATUS_COLOURS = {
  draft:      { bg: 'oklch(0.95 0.01 240)', fg: 'oklch(0.45 0.05 240)' },
  scheduled:  { bg: 'oklch(0.95 0.07 220)', fg: 'oklch(0.45 0.15 220)' },
  publishing: { bg: 'oklch(0.95 0.10 90)',  fg: 'oklch(0.50 0.15 90)'  },
  published:  { bg: 'oklch(0.95 0.10 145)', fg: 'oklch(0.45 0.15 145)' },
  failed:     { bg: 'oklch(0.95 0.15 25)',  fg: 'oklch(0.50 0.20 25)'  },
  cancelled:  { bg: 'oklch(0.95 0.00 0)',   fg: 'oklch(0.45 0.00 0)'   },
} as const

export type PostStatusKey = keyof typeof POST_STATUS_COLOURS

// ── Character limits per platform ───────────────────────────────────────────

/** Character limits sourced from each platform's current public docs
 *  (and cross-checked against Mixpost Pro's usePostCharacterLimit
 *  composable — same numbers, independently verified).
 *
 *  Verify these against platform docs before shipping Phase 3 —
 *  Twitter/X in particular has changed this several times. */
export const PLATFORM_CHAR_LIMITS = {
  facebook:  63206,
  instagram: 2200,
  twitter:   280,
  threads:   500,
  linkedin:  3000,
  tiktok:    2200,
  mastodon:  500,
  youtube:   5000,
  pinterest: 500,
  bluesky:   300,
} as const satisfies Record<PlatformKey, number>

/** Character count at which the UI should start warning the user
 *  (approaching limit). Defaults to 90% of the hard limit. */
export function softLimitFor(platform: PlatformKey): number {
  return Math.floor(PLATFORM_CHAR_LIMITS[platform] * 0.9)
}

// ── Media constraints per platform ──────────────────────────────────────────

/** Aspect ratio + max duration constraints per platform. Ported from
 *  Mixpost's PostMediaLimit composable logic — re-derived from each
 *  platform's public developer docs. Used by the media validator in
 *  Phase 3 composer. */
export const PLATFORM_MEDIA_LIMITS: Record<
  PlatformKey,
  {
    maxImages: number
    maxVideos: number
    maxVideoSizeMb: number
    maxVideoDurationSec: number
    acceptedAspectRatios: string[]
  }
> = {
  facebook: {
    maxImages: 10,
    maxVideos: 1,
    maxVideoSizeMb: 4096,
    maxVideoDurationSec: 14400,
    acceptedAspectRatios: ['9:16', '1:1', '4:5', '16:9'],
  },
  instagram: {
    maxImages: 10,
    maxVideos: 1,
    maxVideoSizeMb: 650,
    maxVideoDurationSec: 900, // 15 min Reels / feed
    acceptedAspectRatios: ['9:16', '1:1', '4:5'],
  },
  twitter: {
    maxImages: 4,
    maxVideos: 1,
    maxVideoSizeMb: 512,
    maxVideoDurationSec: 140,
    acceptedAspectRatios: ['16:9', '1:1', '9:16'],
  },
  threads: {
    maxImages: 10,
    maxVideos: 1,
    maxVideoSizeMb: 1000,
    maxVideoDurationSec: 300,
    acceptedAspectRatios: ['9:16', '1:1', '4:5'],
  },
  linkedin: {
    maxImages: 9,
    maxVideos: 1,
    maxVideoSizeMb: 5120,
    maxVideoDurationSec: 600,
    acceptedAspectRatios: ['16:9', '1:1', '9:16'],
  },
  tiktok: {
    maxImages: 35,
    maxVideos: 1,
    maxVideoSizeMb: 4096,
    maxVideoDurationSec: 600,
    acceptedAspectRatios: ['9:16', '1:1'],
  },
  mastodon: {
    maxImages: 4,
    maxVideos: 1,
    maxVideoSizeMb: 200,
    maxVideoDurationSec: 300,
    acceptedAspectRatios: ['16:9', '1:1', '4:5', '9:16'],
  },
  youtube: {
    maxImages: 0,
    maxVideos: 1,
    maxVideoSizeMb: 262144, // 256 GB
    maxVideoDurationSec: 43200, // 12 hours
    acceptedAspectRatios: ['16:9', '9:16'],
  },
  pinterest: {
    maxImages: 1,
    maxVideos: 1,
    maxVideoSizeMb: 2048,
    maxVideoDurationSec: 900,
    acceptedAspectRatios: ['2:3', '1:1', '9:16'],
  },
  bluesky: {
    maxImages: 4,
    maxVideos: 1,
    maxVideoSizeMb: 100,
    maxVideoDurationSec: 180,
    acceptedAspectRatios: ['16:9', '1:1', '9:16'],
  },
}
