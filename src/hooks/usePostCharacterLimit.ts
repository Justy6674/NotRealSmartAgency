import { useMemo } from 'react'
import {
  PLATFORM_CHAR_LIMITS,
  type PlatformKey,
} from '@/lib/mixpost/ui-tokens'

export interface CharLimitInfo {
  platform: PlatformKey
  limit: number
  softLimit: number
  used: number
  remaining: number
  percent: number
  state: 'ok' | 'warning' | 'over'
  /** True when the ceiling came from the publisher, not from our local table. */
  fromPublisher: boolean
}

/**
 * Ceilings the publisher itself reports, keyed by ITS names, mapped onto ours.
 *
 * `twitterPremium` is deliberately absent: which of the two X limits applies
 * depends on the account, and picking the generous one for an account that does
 * not have Premium is exactly the optimistic guess this whole file exists to
 * stop. The per-account answer arrives with `validatePost`, which is asked with
 * the accountId and refuses in words the owner can read.
 */
const PUBLISHER_TARGET_BY_PLATFORM: Record<PlatformKey, string> = {
  facebook: 'facebook',
  instagram: 'instagram',
  twitter: 'twitter',
  threads: 'threads',
  linkedin: 'linkedin',
  tiktok: 'tiktok',
  mastodon: 'mastodon',
  youtube: 'youtube',
  pinterest: 'pinterest',
  bluesky: 'bluesky',
}

/** One published ceiling, however it was learnt. */
export interface PublisherLimits {
  [target: string]: { limit: number }
}

/**
 * Turn the publisher's report into the platform-keyed ceilings this app uses.
 *
 * A zero or missing limit is dropped rather than believed: `limit: 0` would
 * make every caption over the line and switch Save off with no way back, which
 * is worse than falling through to the local table.
 */
export function limitsFromPublisher(
  report: PublisherLimits | null | undefined,
): Partial<Record<PlatformKey, number>> {
  if (!report) return {}
  const out: Partial<Record<PlatformKey, number>> = {}
  for (const [platform, target] of Object.entries(PUBLISHER_TARGET_BY_PLATFORM) as Array<
    [PlatformKey, string]
  >) {
    const entry = report[target]
    if (entry && typeof entry.limit === 'number' && entry.limit > 0) {
      out[platform] = entry.limit
    }
  }
  return out
}

/**
 * The ceiling that actually applies to one platform.
 *
 * The publisher's number wins whenever we have it. The local table is a
 * fallback for the backup connection and for the moments before the first
 * pre-flight answers — never the source of truth, because a limit kept in two
 * places drifts and the copy that matters is the one the send enforces.
 */
export function limitFor(
  platform: PlatformKey,
  publisherLimits?: Partial<Record<PlatformKey, number>>,
): { limit: number; fromPublisher: boolean } {
  const published = publisherLimits?.[platform]
  if (typeof published === 'number' && published > 0) {
    return { limit: published, fromPublisher: true }
  }
  return { limit: PLATFORM_CHAR_LIMITS[platform], fromPublisher: false }
}

/**
 * Live character count per platform.
 *
 * Counts graphemes as characters (one emoji = one visual char in most platform
 * counts). `Array.from(text).length` approximates grapheme count for CJK and
 * emoji without pulling in a full Unicode segmenter, and it is the same
 * approximation every warning in the composer quotes, so no two numbers on
 * screen can contradict each other.
 */
export function usePostCharacterLimit(
  caption: string,
  platforms: PlatformKey[],
  publisherLimits?: Partial<Record<PlatformKey, number>>,
): CharLimitInfo[] {
  return useMemo(() => {
    const used = Array.from(caption).length

    return platforms.map((platform): CharLimitInfo => {
      const { limit, fromPublisher } = limitFor(platform, publisherLimits)
      const soft = Math.floor(limit * 0.9)
      const percent = limit > 0 ? (used / limit) * 100 : 0
      const state: CharLimitInfo['state'] =
        used > limit ? 'over' : used >= soft ? 'warning' : 'ok'
      return {
        platform,
        limit,
        softLimit: soft,
        used,
        remaining: limit - used,
        percent: Math.min(percent, 100),
        state,
        fromPublisher,
      }
    })
  }, [caption, platforms, publisherLimits])
}

/**
 * Returns true if the caption is within limits on EVERY selected platform.
 * The "can I publish" gate — Save reads it, so it must never be optimistic.
 */
export function isCaptionWithinAllLimits(
  caption: string,
  platforms: PlatformKey[],
  publisherLimits?: Partial<Record<PlatformKey, number>>,
): boolean {
  const used = Array.from(caption).length
  return platforms.every((p) => used <= limitFor(p, publisherLimits).limit)
}
