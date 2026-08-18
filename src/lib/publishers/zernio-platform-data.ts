/**
 * Composer `platform_options` → Zernio `platformSpecificData`.
 *
 * Depended on by: `dispatcher.ts` at the moment of publishing, and the
 * composer's option panels (S3), which read `composerFieldStatus` to decide
 * whether a control is a live input or a greyed one with a reason.
 *
 * Several of these fields are FREE TEXT that reaches a live account —
 * `first_comment`, `title`, `document_title`, `thread_items`. They are words
 * the reader sees, so they go through the AHPRA/TGA review with the caption;
 * the gate reads the whole options object generically rather than a list of
 * names (`outboundTextForReview`, src/lib/agents/publish-gate.ts), so a field
 * added here is reviewed without anything being added there. Do not add a key
 * to that file's deny-list unless its value could never carry a claim.
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
    share_to_feed: { ships: true, zernioKey: 'shareToFeed' },
    collaborators: { ships: true, zernioKey: 'collaborators' },
    ai_disclosure: { ships: true, zernioKey: 'isAiGenerated' },
  },
  facebook: {
    first_comment: { ships: true, zernioKey: 'firstComment' },
    title: { ships: true, zernioKey: 'title' },
    link_preview: {
      ships: false,
      reason: 'Facebook decides the link preview from the link itself. There is no switch for it on a post.',
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
    commercial_content: { ships: true, zernioKey: 'commercialContentType' },
    brand_partnership: { ships: true, zernioKey: 'brandPartnerPromote' },
    auto_add_music: { ships: true, zernioKey: 'autoAddMusic' },
    cover_image_url: { ships: true, zernioKey: 'videoCoverImageUrl' },
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
    first_comment: { ships: true, zernioKey: 'firstComment' },
    playlist: { ships: true, zernioKey: 'playlistId' },
    ai_disclosure: { ships: true, zernioKey: 'containsSyntheticMedia' },
  },
  linkedin: {
    first_comment: { ships: true, zernioKey: 'firstComment' },
    document_title: { ships: true, zernioKey: 'documentTitle' },
    link_preview: { ships: true, zernioKey: 'disableLinkPreview' },
    article_link: {
      ships: false,
      reason: 'A LinkedIn article URL is not a post setting. Put the link in the caption, or reshare the article instead.',
    },
  },
  twitter: {
    /*
     * A thread ships — but only when the posts are written out.
     *
     * `TwitterPlatformData.threadItems[]` is a real field, so the old blanket
     * refusal was wrong about the capability. It was right about the control:
     * a yes/no switch still cannot invent the follow-up posts, so the SWITCH is
     * refused and `thread_items` — the written-out list — is what ships.
     */
    thread: {
      ships: false,
      reason: 'A thread needs each post written out. Add them below and they go out in order.',
    },
    thread_items: { ships: true, zernioKey: 'threadItems' },
    reply_settings: { ships: true, zernioKey: 'replySettings' },
    sensitive_media: { ships: true, zernioKey: 'sensitiveMedia' },
    ai_disclosure: { ships: true, zernioKey: 'madeWithAi' },
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
      // Owner-facing copy names no vendor. The owner has never been told what
      // "Mixpost" is and this is not the place to start.
      reason: 'This business posts through the backup connection, which cannot take this setting.',
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

/** A list of non-empty strings, or nothing. An empty array is not a value. */
function strList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out = value.flatMap((entry) => {
    const text = str(entry)
    return text ? [text] : []
  })
  return out.length > 0 ? out : undefined
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
      const shareToFeed = bool(options.share_to_feed)
      if (shareToFeed !== undefined) out.shareToFeed = shareToFeed
      const collaborators = strList(options.collaborators)
      if (collaborators) out.collaborators = collaborators
      const aiGenerated = bool(options.ai_disclosure)
      if (aiGenerated !== undefined) out.isAiGenerated = aiGenerated
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
      const commercial = str(options.commercial_content)
      if (commercial) out.commercialContentType = commercial
      const brandPartner = bool(options.brand_partnership)
      if (brandPartner !== undefined) out.brandPartnerPromote = brandPartner
      const autoMusic = bool(options.auto_add_music)
      if (autoMusic !== undefined) out.autoAddMusic = autoMusic
      const tiktokCover = str(options.cover_image_url)
      if (tiktokCover) out.videoCoverImageUrl = tiktokCover
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
      const ytFirstComment = str(options.first_comment)
      if (ytFirstComment) out.firstComment = ytFirstComment
      const playlistId = str(options.playlist)
      if (playlistId) out.playlistId = playlistId
      const synthetic = bool(options.ai_disclosure)
      if (synthetic !== undefined) out.containsSyntheticMedia = synthetic
      break
    }
    case 'linkedin': {
      const firstComment = str(options.first_comment)
      if (firstComment) out.firstComment = firstComment
      const documentTitle = str(options.document_title)
      if (documentTitle) out.documentTitle = documentTitle
      const linkPreview = bool(options.link_preview)
      // The composer asks "show a link preview?"; the SDK asks the opposite
      // question. Sending the answer through unflipped would turn the preview
      // off for everyone who asked for it.
      if (linkPreview !== undefined) out.disableLinkPreview = !linkPreview
      break
    }
    case 'twitter': {
      const ai = bool(options.ai_disclosure)
      if (ai !== undefined) out.madeWithAi = ai
      const replySettings = str(options.reply_settings)
      if (replySettings) out.replySettings = replySettings
      const sensitive = bool(options.sensitive_media)
      if (sensitive !== undefined) out.sensitiveMedia = sensitive
      /*
       * A thread is the written-out posts, never the switch. `thread: true`
       * with nothing written is dropped on purpose: publishing a one-post
       * "thread" and calling it done is worse than saying it did not happen.
       *
       * threadItems[0] MUST be the first post. When threadItems is present the
       * top-level content is used for display and search only and is never
       * published — so a caller that puts only the follow-ups here loses the
       * opening post entirely.
       */
      const threadItems = strList(options.thread_items)
      if (threadItems) out.threadItems = threadItems.map((text) => ({ content: text }))
      break
    }
  }

  return Object.keys(out).length > 0 ? out : undefined
}

const TIKTOK_PRIVACY_FROM_SDK: Record<string, string> = Object.fromEntries(
  Object.entries(TIKTOK_PRIVACY).map(([composer, sdk]) => [sdk, composer]),
)

const COMPOSER_FROM_SDK: Record<string, Record<string, string>> = {
  instagram: {
    firstComment: 'first_comment',
    instagramThumbnail: 'cover_image_url',
    shareToFeed: 'share_to_feed',
    collaborators: 'collaborators',
    isAiGenerated: 'ai_disclosure',
  },
  tiktok: {
    privacyLevel: 'privacy',
    allowComment: 'allow_comments',
    allowDuet: 'allow_duet',
    allowStitch: 'allow_stitch',
    videoMadeWithAi: 'ai_disclosure',
    commercialContentType: 'commercial_content',
    brandPartnerPromote: 'brand_partnership',
    autoAddMusic: 'auto_add_music',
    videoCoverImageUrl: 'cover_image_url',
  },
  youtube: {
    title: 'title',
    visibility: 'privacy',
    madeForKids: 'made_for_kids',
    categoryId: 'category',
    firstComment: 'first_comment',
    playlistId: 'playlist',
    containsSyntheticMedia: 'ai_disclosure',
  },
  facebook: { title: 'title', firstComment: 'first_comment' },
  linkedin: {
    firstComment: 'first_comment',
    documentTitle: 'document_title',
  },
  twitter: {
    madeWithAi: 'ai_disclosure',
    replySettings: 'reply_settings',
    sensitiveMedia: 'sensitive_media',
  },
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
