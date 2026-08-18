export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'linkedin',
  'twitter',
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

export const SOCIAL_CONTENT_TYPES = [
  'feed',
  'carousel',
  'story',
  'reel',
  'short_video',
  'long_video',
  'document',
  'thread',
  'poll',
] as const

export type SocialContentType = (typeof SOCIAL_CONTENT_TYPES)[number]

export interface SocialMediaRef {
  mediaItemId: string
  position: number
  type: 'image' | 'video' | 'gif' | 'document'
  title?: string
  altText?: string
  thumbnailUrl?: string
}

export type SocialCoverSource =
  | { kind: 'media'; mediaItemId: string }
  | { kind: 'url'; url: string }
  | { kind: 'frame'; offsetMs: number }

/**
 * Per-platform extras. Keys must exist on the matching *PlatformData in
 * `node_modules/@zernio/node/dist/index.d.ts`. Record, not a typed union —
 * assigning InstagramOptions into Record<string, unknown> is what broke
 * `npm run build` on the first restore.
 */
export type PlatformOptionsMap = Record<string, unknown>

export interface SocialTarget {
  targetId: string
  platform: SocialPlatform
  accountIds: string[]
  captionOverride?: string
  title?: string
  firstComment?: string
  cover?: SocialCoverSource
  mediaOverride?: SocialMediaRef[]
  options: PlatformOptionsMap
}

export interface SocialSchedule {
  mode: 'draft' | 'next_slot' | 'at' | 'now'
  scheduledAt?: string
  timezone: string
}

export interface SocialPostDocumentV1 {
  schemaVersion: 1
  compositionId: string
  brandId: string
  ownerUserId: string
  conversationId: string | null
  revision: number
  lifecycle: 'editing' | 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'
  masterCaption: string
  hashtags: string[]
  contentType: SocialContentType
  media: SocialMediaRef[]
  targets: SocialTarget[]
  schedule: SocialSchedule
  compliance: {
    captionHash?: string
    checkedAt?: string
    allowed?: boolean
    warnings: string[]
  }
  updatedAt: string
}
