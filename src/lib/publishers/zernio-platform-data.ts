/**
 * Composer `platform_options` → Zernio `platformSpecificData`.
 *
 * Field names come from `node_modules/@zernio/node/dist/index.d.ts`
 * (`InstagramPlatformData`, `TikTokPlatformData`, `YouTubePlatformData`, …).
 * A composer key that has no SDK name is dropped, never renamed by guess.
 * The UI reads `composerFieldStatus` so a switch we cannot deliver is shown
 * as off, with the reason, instead of looking applied.
 */

import type { PublisherPlatform } from './types'

export type FieldStatus =
  | { ships: true; zernioKey: string }
  | { ships: false; reason: string }

/** Composer control → whether the publishing pipe can actually send it. */
export const COMPOSER_FIELDS: Record<string, Record<string, FieldStatus>> = {
  instagram: {
    first_comment: { ships: true, zernioKey: 'firstComment' },
    cover_image_url: { ships: true, zernioKey: 'instagramThumbnail' },
  },
  facebook: {
    link_preview: {
      ships: false,
      reason: 'Facebook has no link-preview switch on a Zernio post. The preview is decided by the link itself.',
    },
  },
  tiktok: {
    title: {
      ships: false,
      reason: 'TikTok has no title field on a video post. The caption is what people see.',
    },
    privacy: { ships: true, zernioKey: 'privacyLevel' },
    allow_comments: { ships: true, zernioKey: 'allowComment' },
    allow_duet: { ships: true, zernioKey: 'allowDuet' },
    allow_stitch: { ships: true, zernioKey: 'allowStitch' },
    ai_disclosure: { ships: true, zernioKey: 'videoMadeWithAi' },
  },
  youtube: {
    title: { ships: true, zernioKey: 'title' },
    category: { ships: true, zernioKey: 'categoryId' },
    privacy: { ships: true, zernioKey: 'visibility' },
    shorts: {
      ships: false,
      reason: 'YouTube detects Shorts from the video itself (under ~3 minutes, vertical). There is no Shorts switch on the post.',
    },
    made_for_kids: { ships: true, zernioKey: 'madeForKids' },
  },
  linkedin: {
    article_link: {
      ships: false,
      reason: 'A LinkedIn article URL is not a Zernio post setting. Put the link in the caption, or reshare a LinkedIn post.',
    },
  },
  twitter: {
    thread: {
      ships: false,
      reason: 'Posting a thread needs each tweet written out. A yes/no switch cannot invent them.',
    },
  },
}

const TIKTOK_PRIVACY: Record<string, string> = {
  public: 'PUBLIC_TO_EVERYONE',
  friends: 'MUTUAL_FOLLOW_FRIENDS',
  private: 'SELF_ONLY',
}

const YOUTUBE_VISIBILITY = new Set(['public', 'private', 'unlisted'])

export function composerFieldStatus(platform: string, key: string): FieldStatus | null {
  return COMPOSER_FIELDS[platform]?.[key] ?? null
}

const MIXPOST_SHIPPED: Record<string, Set<string>> = {
  youtube: new Set(['title', 'privacy', 'made_for_kids']),
}

/**
 * Mixpost-only brands only get the keys Mixpost actually accepts.
 * A Zernio-only field is shown as off, with the reason, not as a working switch.
 */
export function composerFieldStatusForTransport(
  platform: string,
  key: string,
  transport: 'zernio' | 'mixpost',
): FieldStatus | null {
  const status = composerFieldStatus(platform, key)
  if (!status) return null
  if (transport === 'zernio') return status
  if (status.ships && MIXPOST_SHIPPED[platform]?.has(key)) return status
  if (status.ships) {
    return {
      ships: false,
      reason: 'This business posts through Mixpost, which does not take this setting.',
    }
  }
  return status
}

export function platformOptionsOf(
  metadata: unknown,
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined
  const options = (metadata as Record<string, unknown>).platform_options
  if (!options || typeof options !== 'object' || Array.isArray(options)) return undefined
  return options as Record<string, unknown>
}

function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

function bool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

/**
 * Only keys that exist on the matching *PlatformData type are returned.
 * Empty object means "send nothing extra" — callers must omit the field.
 */
export function toZernioPlatformData(opts: {
  platform: PublisherPlatform
  options?: Record<string, unknown> | null
  postType?: string | null
}): Record<string, unknown> | undefined {
  const options = opts.options ?? {}
  const out: Record<string, unknown> = {}

  switch (opts.platform) {
    case 'instagram': {
      const firstComment = str(options.first_comment)
      if (firstComment) out.firstComment = firstComment
      const cover = str(options.cover_image_url)
      if (cover) out.instagramThumbnail = cover
      break
    }
    case 'facebook': {
      if (opts.postType === 'reel') out.contentType = 'reel'
      else if (opts.postType === 'story') out.contentType = 'story'
      const firstComment = str(options.first_comment)
      if (firstComment) out.firstComment = firstComment
      const title = str(options.title)
      if (title) out.title = title
      break
    }
    case 'tiktok': {
      const privacy = str(options.privacy)
      if (privacy && TIKTOK_PRIVACY[privacy]) out.privacyLevel = TIKTOK_PRIVACY[privacy]
      const allowComment = bool(options.allow_comments)
      if (allowComment !== undefined) out.allowComment = allowComment
      const allowDuet = bool(options.allow_duet)
      if (allowDuet !== undefined) out.allowDuet = allowDuet
      const allowStitch = bool(options.allow_stitch)
      if (allowStitch !== undefined) out.allowStitch = allowStitch
      const ai = bool(options.ai_disclosure)
      if (ai !== undefined) out.videoMadeWithAi = ai
      break
    }
    case 'youtube': {
      const title = str(options.title)
      if (title) out.title = title.slice(0, 100)
      const visibility = str(options.privacy)
      if (visibility && YOUTUBE_VISIBILITY.has(visibility)) out.visibility = visibility
      const madeForKids = bool(options.made_for_kids)
      if (madeForKids !== undefined) out.madeForKids = madeForKids
      const categoryId = str(options.category)
      if (categoryId) out.categoryId = categoryId
      break
    }
    case 'linkedin': {
      const firstComment = str(options.first_comment)
      if (firstComment) out.firstComment = firstComment
      break
    }
    case 'twitter': {
      const ai = bool(options.ai_disclosure)
      if (ai !== undefined) out.madeWithAi = ai
      break
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

const TIKTOK_PRIVACY_FROM_SDK: Record<string, string> = Object.fromEntries(
  Object.entries(TIKTOK_PRIVACY).map(([composer, sdk]) => [sdk, composer]),
)

const COMPOSER_FROM_SDK: Record<string, Record<string, string>> = {
  instagram: { firstComment: 'first_comment', instagramThumbnail: 'cover_image_url' },
  tiktok: {
    privacyLevel: 'privacy',
    allowComment: 'allow_comments',
    allowDuet: 'allow_duet',
    allowStitch: 'allow_stitch',
    videoMadeWithAi: 'ai_disclosure',
  },
  youtube: {
    title: 'title',
    visibility: 'privacy',
    madeForKids: 'made_for_kids',
    categoryId: 'category',
  },
  facebook: { title: 'title', firstComment: 'first_comment' },
  linkedin: { firstComment: 'first_comment' },
  twitter: { madeWithAi: 'ai_disclosure' },
}

/**
 * Desk UI reads composer snake_case. The reducer stores SDK names.
 * Map back so a Director fill shows up on the same switches the owner uses.
 */
export function sdkOptionsToComposer(
  platform: string,
  options: Record<string, unknown>,
): Record<string, unknown> {
  const map = COMPOSER_FROM_SDK[platform]
  if (!map) return { ...options }
  const out: Record<string, unknown> = {}
  for (const [sdkKey, value] of Object.entries(options)) {
    const composerKey = map[sdkKey] ?? sdkKey
    if (platform === 'tiktok' && sdkKey === 'privacyLevel' && typeof value === 'string') {
      out[composerKey] = TIKTOK_PRIVACY_FROM_SDK[value] ?? value
    } else {
      out[composerKey] = value
    }
  }
  return out
}
