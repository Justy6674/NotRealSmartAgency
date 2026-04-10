import { useMemo } from 'react'
import {
  PLATFORM_CHAR_LIMITS,
  softLimitFor,
  type PlatformKey,
} from '@/lib/mixpost/ui-tokens'

interface CharLimitInfo {
  platform: PlatformKey
  limit: number
  softLimit: number
  used: number
  remaining: number
  percent: number
  state: 'ok' | 'warning' | 'over'
}

/**
 * Live character count per platform.
 *
 * Phase 3 of the Mixpost UI port — matches Mixpost's usePostCharacterLimit
 * composable (95 LOC) but hooked into React state instead of Vue refs.
 *
 * Counts graphemes as characters (one emoji = one visual char in most
 * platform counts). `Array.from(text).length` gives a good approximation
 * of grapheme count for CJK + emoji without pulling in a full Unicode
 * segmenter.
 *
 * Usage:
 *   const limits = usePostCharacterLimit(caption, ['instagram','facebook'])
 *   limits[0] // { platform: 'instagram', limit: 2200, used: 123, ... }
 */
export function usePostCharacterLimit(
  caption: string,
  platforms: PlatformKey[],
): CharLimitInfo[] {
  return useMemo(() => {
    // Approximate grapheme count — good enough for the counter widget;
    // platforms use different counting rules internally (Twitter weighs
    // URLs as 23, etc.) but this matches what users see in the UI.
    const used = Array.from(caption).length

    return platforms.map((platform): CharLimitInfo => {
      const limit = PLATFORM_CHAR_LIMITS[platform]
      const soft = softLimitFor(platform)
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
      }
    })
  }, [caption, platforms])
}

/**
 * Returns true if the caption is within limits on EVERY selected platform.
 * Useful as a "can I publish" gate.
 */
export function isCaptionWithinAllLimits(
  caption: string,
  platforms: PlatformKey[],
): boolean {
  const used = Array.from(caption).length
  return platforms.every((p) => used <= PLATFORM_CHAR_LIMITS[p])
}
