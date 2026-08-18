import type { SocialPlatform } from './model'

export interface PlatformCapability {
  optionKeys: readonly string[]
  title: boolean
  firstComment: boolean
  cover: 'supported' | 'conditional' | 'unsupported'
}

export type SocialPlatformCapabilities = Record<SocialPlatform, PlatformCapability>

/**
 * Keys copied from `node_modules/@zernio/node/dist/index.d.ts`
 * (*PlatformData types). A name that is not on that type is not a capability.
 */
export const SOCIAL_PLATFORM_CAPABILITIES: SocialPlatformCapabilities = {
  instagram: {
    optionKeys: ['shareToFeed', 'collaborators', 'userTags', 'isAiGenerated', 'contentType'],
    title: false,
    firstComment: true,
    cover: 'conditional',
  },
  facebook: {
    optionKeys: ['contentType', 'title'],
    title: true,
    firstComment: true,
    cover: 'unsupported',
  },
  tiktok: {
    optionKeys: [
      'privacyLevel',
      'allowComment',
      'allowDuet',
      'allowStitch',
      'commercialContentType',
      'expressConsentGiven',
      'autoAddMusic',
      'videoMadeWithAi',
      'draft',
    ],
    title: false,
    firstComment: false,
    cover: 'supported',
  },
  youtube: {
    optionKeys: ['visibility', 'madeForKids', 'containsSyntheticMedia', 'categoryId', 'playlistId'],
    title: true,
    firstComment: true,
    cover: 'unsupported',
  },
  linkedin: {
    optionKeys: ['documentTitle', 'organizationUrn', 'disableLinkPreview'],
    title: true,
    firstComment: true,
    cover: 'unsupported',
  },
  twitter: {
    optionKeys: ['replySettings', 'paidPartnership', 'madeWithAi', 'longVideo'],
    title: false,
    firstComment: false,
    cover: 'unsupported',
  },
}
