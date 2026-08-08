/**
 * Pick a bitrate that lands the file under the size a platform will fetch.
 *
 * A fixed ceiling cannot do this. 4500 kbps is a sensible cap for a
 * thirty-second clip and produces 93 MB from a two-and-a-half-minute one —
 * over the limit, and straight into "Media upload has failed with error code
 * 2207082" long after the draft looked fine. The only input that decides the
 * size of a capped encode is how long it runs.
 *
 * Pure, so the arithmetic that decides whether a post can be published at all
 * is actually testable.
 */

/** Never worth exceeding even on a very short clip. */
export const MAX_VIDEO_BITRATE_KBPS = 4500
/**
 * Below this the picture falls apart, and a bad-looking post is its own
 * failure. A clip that cannot fit under the limit at this rate needs to be
 * shorter, and saying so is better than shipping mush.
 */
export const MIN_VIDEO_BITRATE_KBPS = 1200
export const AUDIO_BITRATE_KBPS = 128
/**
 * Encoders overshoot. A rate cap is an average, not a guarantee, and container
 * overhead is real — aiming exactly at the limit lands just over it.
 */
const HEADROOM = 0.9

export interface BitratePlan {
  videoKbps: number
  /** False when even the floor cannot fit; the caller must say so, not guess. */
  fits: boolean
}

export function bitrateForDuration(seconds: number, maxBytes: number): BitratePlan {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return { videoKbps: MAX_VIDEO_BITRATE_KBPS, fits: true }
  }

  const budgetKbps = (maxBytes * 8 * HEADROOM) / 1000 / seconds - AUDIO_BITRATE_KBPS
  const chosen = Math.floor(Math.min(MAX_VIDEO_BITRATE_KBPS, Math.max(MIN_VIDEO_BITRATE_KBPS, budgetKbps)))

  return { videoKbps: chosen, fits: budgetKbps >= MIN_VIDEO_BITRATE_KBPS }
}

/** The longest clip that still fits at a watchable bitrate. */
export function longestThatFits(maxBytes: number): number {
  return Math.floor(
    (maxBytes * 8 * HEADROOM) / 1000 / (MIN_VIDEO_BITRATE_KBPS + AUDIO_BITRATE_KBPS),
  )
}
