/**
 * Pre-flight: ask the publisher what it will refuse, before anyone presses send.
 *
 * Depended on by: the composer's error band and character counts (S3), the
 * media library's upload limits (S5), and the Reddit target picker.
 *
 * ── Why this replaces our local tables ─────────────────────────────────
 * NRS carried its own character limits and its own media rules. Two copies of a
 * rule drift, and the copy that matters is the one publishing enforces — so the
 * owner would be told 2,200 characters was fine and then watch the post fail.
 * These endpoints are a free dry run of the EXACT rules the send applies, and
 * `validatePost` honours per-platform `customContent`: 300 characters with a
 * Twitter target errors, and the same call with `customContent: 'short'` on
 * Twitter does not.
 *
 * Nothing here writes, publishes or costs money. Call it on a debounce.
 */

import { getZernioClient } from './client'
import { unwrapZernio } from './errors'
import type {
  ZernioLengthCheck,
  ZernioLengthReport,
  ZernioMediaItem,
  ZernioMediaValidation,
  ZernioPlatform,
  ZernioValidation,
} from './types'

/** One target to check. `accountId` resolves X Premium's 25,000-char limit. */
export interface ZernioValidationTarget {
  platform: ZernioPlatform
  accountId?: string
  customContent?: string
  customMedia?: ZernioMediaItem[]
  platformSpecificData?: Record<string, unknown>
}

function issues(raw: unknown, key: 'error' | 'warning') {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const message = rec[key]
    if (typeof message !== 'string' || !message.trim()) return []
    return [{
      platform: typeof rec.platform === 'string' ? rec.platform : '',
      message: message.trim(),
    }]
  })
}

/**
 * Would this post be accepted, per platform?
 *
 * `valid: false` with an empty `errors` array is possible on the loose union
 * the SDK declares, so the verdict is computed from both rather than trusted
 * from one — a validator that says "not valid" and lists nothing is worse than
 * useless in front of a non-technical owner.
 */
export async function validateZernioPost(params: {
  content?: string
  mediaItems?: ZernioMediaItem[]
  platforms: ZernioValidationTarget[]
}): Promise<ZernioValidation> {
  const zernio = getZernioClient('validate.validatePost')
  const result = await zernio.validate.validatePost({
    body: {
      ...(params.content !== undefined ? { content: params.content } : {}),
      ...(params.mediaItems && params.mediaItems.length > 0
        ? { mediaItems: params.mediaItems }
        : {}),
      platforms: params.platforms.map((target) => ({
        platform: target.platform,
        ...(target.accountId ? { accountId: target.accountId } : {}),
        ...(target.customContent ? { customContent: target.customContent } : {}),
        ...(target.customMedia && target.customMedia.length > 0
          ? { customMedia: target.customMedia }
          : {}),
        ...(target.platformSpecificData
          ? { platformSpecificData: target.platformSpecificData }
          : {}),
      })),
    },
  })

  const data = unwrapZernio<Record<string, unknown>>('validate.validatePost', result as never)
  const errors = issues(data.errors, 'error')
  const warnings = issues(data.warnings, 'warning')
  return { valid: data.valid === true && errors.length === 0, errors, warnings }
}

/**
 * Character counts and ceilings for one string, on every network at once.
 *
 * Fifteen targets came back live, including `twitterPremium` at 25,000 and
 * `telegramCaption` at 1,024 — the caption limit that applies when the post
 * carries media, which is a different number from `telegram`'s 4,096 and the
 * kind of distinction a hand-maintained table always loses.
 */
export async function validateZernioPostLength(text: string): Promise<ZernioLengthReport> {
  const zernio = getZernioClient('validate.validatePostLength')
  const result = await zernio.validate.validatePostLength({ body: { text } })
  const data = unwrapZernio<Record<string, unknown>>('validate.validatePostLength', result as never)

  const out: ZernioLengthReport = {}
  const platforms = (data.platforms ?? {}) as Record<string, unknown>
  for (const [name, raw] of Object.entries(platforms)) {
    const rec = (raw ?? {}) as Record<string, unknown>
    const count = typeof rec.count === 'number' ? rec.count : 0
    const limit = typeof rec.limit === 'number' ? rec.limit : 0
    const check: ZernioLengthCheck = {
      count,
      limit,
      valid: rec.valid === true,
    }
    out[name] = check
  }
  return out
}

/**
 * Byte limits per platform for one media URL.
 *
 * Live limits vary by more than an order of magnitude — Bluesky 1 MB, X and
 * Google Business 5 MB, Instagram/Threads/LinkedIn 8 MB, Facebook/Telegram
 * 10 MB, TikTok/Reddit/Snapchat 20 MB, Discord 26 MB, Pinterest 33.5 MB — so
 * "the file is fine" is only ever true of a named platform.
 */
export async function validateZernioMedia(url: string): Promise<ZernioMediaValidation> {
  const zernio = getZernioClient('validate.validateMedia')
  const result = await zernio.validate.validateMedia({ body: { url } })
  const data = unwrapZernio<Record<string, unknown>>('validate.validateMedia', result as never)

  const limits: Record<string, { limit: number; limitFormatted: string; withinLimit: boolean }> = {}
  const raw = (data.platformLimits ?? {}) as Record<string, unknown>
  for (const [platform, entry] of Object.entries(raw)) {
    const rec = (entry ?? {}) as Record<string, unknown>
    limits[platform] = {
      limit: typeof rec.limit === 'number' ? rec.limit : 0,
      limitFormatted: typeof rec.limitFormatted === 'string' ? rec.limitFormatted : '',
      withinLimit: rec.withinLimit === true,
    }
  }

  return {
    valid: data.valid === true,
    url: typeof data.url === 'string' ? data.url : url,
    ...(typeof data.error === 'string' ? { error: data.error } : {}),
    ...(typeof data.contentType === 'string' ? { contentType: data.contentType } : {}),
    ...(typeof data.size === 'number' ? { size: data.size } : {}),
    ...(typeof data.sizeFormatted === 'string' ? { sizeFormatted: data.sizeFormatted } : {}),
    ...(data.type === 'image' || data.type === 'video' || data.type === 'unknown'
      ? { type: data.type }
      : {}),
    platformLimits: limits,
  }
}

/** Does this subreddit exist, and will this account be allowed to post in it? */
export async function validateZernioSubreddit(params: {
  name: string
  accountId?: string
}): Promise<Record<string, unknown>> {
  const zernio = getZernioClient('validate.validateSubreddit')
  const result = await zernio.validate.validateSubreddit({
    query: {
      name: params.name,
      ...(params.accountId ? { accountId: params.accountId } : {}),
    },
  })
  return unwrapZernio<Record<string, unknown>>('validate.validateSubreddit', result as never)
}
