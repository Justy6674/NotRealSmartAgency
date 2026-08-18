/**
 * What each network can actually be told, per post.
 *
 * Depended on by: the composer's provider option panels and version tabs (S3),
 * the preview renderers (S3), and `src/lib/publishers/zernio-platform-data.ts`,
 * which maps a composer switch onto the SDK name it ships as.
 *
 * A key that is not on the matching `*PlatformData` type in
 * `node_modules/@zernio/node/dist/index.d.ts` is not a capability, however
 * reasonable it sounds. Every list below was read out of that file (0.2.587),
 * not remembered. The composer's rule is the important one: a control that
 * cannot be delivered is shown as off WITH THE REASON, never as a switch that
 * silently does nothing.
 */

import { SOCIAL_PLATFORMS, type SocialPlatform } from './model'

export interface PlatformCapability {
  optionKeys: readonly string[]
  title: boolean
  firstComment: boolean
  cover: 'supported' | 'conditional' | 'unsupported'
  /**
   * Whether the network takes a written-out thread — a real array of further
   * items, not a yes/no switch.
   *
   * Delivery-side truth only. No network the composer offers takes one, so
   * there is no thread control on the surface any more; the flag stays because
   * the publisher still maps `threadItems` for records already out there.
   */
  thread: boolean
}

export type SocialPlatformCapabilities = Record<SocialPlatform, PlatformCapability>

/**
 * The six networks NRS dispatches to today.
 *
 * `SOCIAL_PLATFORMS` (./model) is the union this is keyed by; the wider table
 * below covers the fifteen Zernio accepts, for surfaces that are not limited to
 * what the dispatcher currently sends.
 */
export const SOCIAL_PLATFORM_CAPABILITIES: SocialPlatformCapabilities = {
  instagram: {
    optionKeys: [
      'contentType', 'shareToFeed', 'collaborators', 'firstComment', 'userTags',
      'audioName', 'thumbOffset', 'instagramThumbnail', 'reelCover', 'isAiGenerated',
    ],
    title: false,
    firstComment: true,
    cover: 'conditional',
    thread: false,
  },
  facebook: {
    optionKeys: ['contentType', 'title', 'firstComment', 'pageId'],
    title: true,
    firstComment: true,
    cover: 'unsupported',
    thread: false,
  },
  tiktok: {
    optionKeys: [
      'privacyLevel', 'allowComment', 'allowDuet', 'allowStitch', 'commercialContentType',
      'brandPartnerPromote', 'isBrandOrganicPost', 'expressConsentGiven', 'autoAddMusic',
      'videoMadeWithAi', 'videoCoverTimestampMs', 'videoCoverImageUrl', 'draft',
    ],
    title: false,
    firstComment: false,
    cover: 'supported',
    thread: false,
  },
  youtube: {
    optionKeys: [
      'title', 'visibility', 'madeForKids', 'firstComment',
      'containsSyntheticMedia', 'categoryId', 'playlistId',
    ],
    title: true,
    firstComment: true,
    cover: 'unsupported',
    thread: false,
  },
  linkedin: {
    optionKeys: [
      'documentTitle', 'organizationUrn', 'firstComment', 'disableLinkPreview', 'reshareUrl', 'poll',
    ],
    title: true,
    firstComment: true,
    cover: 'unsupported',
    thread: false,
  },
  /**
   * Retired from the composer on 2026-08-19 — the owner does not use X.
   *
   * The entry stays because it is a DELIVERY fact, not a surface one: posts
   * already published to X are read back through this table by the reducer and
   * the desk-fill path, and removing the key would make an existing X target
   * throw on `capabilities[target.platform].firstComment`. See
   * `RETIRED_COMPOSER_PLATFORMS` below for the surface rule.
   */
  twitter: {
    optionKeys: [
      'replyToTweetId', 'quoteTweetId', 'replySettings', 'threadItems', 'poll',
      'longVideo', 'paidPartnership', 'madeWithAi', 'sensitiveMedia',
    ],
    title: false,
    firstComment: false,
    cover: 'unsupported',
    // `threadItems[]` is a real field and still ships for anything already
    // scheduled. Nothing in the composer writes it any more.
    thread: true,
  },
}

/**
 * Networks the composer has retired.
 *
 * ── Why a subtraction rather than a shorter list ──────────────────────────
 * "Which networks do we offer" and "which networks can we deliver to" are two
 * different questions and were previously answered by six different hand-kept
 * lists — a platform array in the picker, an icon map in the account strip, an
 * options map, a hashtag-limit table, a link-shortener set, a thread map. X was
 * dropped from the surface on 2026-08-19 and each of those had to be found.
 *
 * So the delivery list (`SOCIAL_PLATFORMS`) stays whole — published X posts
 * still have to render in lists and analytics — and the surface is derived from
 * it by subtracting this one line. Retiring the next network is one edit here.
 */
export const RETIRED_COMPOSER_PLATFORMS = ['twitter'] as const

export type RetiredComposerPlatform = (typeof RETIRED_COMPOSER_PLATFORMS)[number]

/** A network the composer will actually offer. */
export type ComposerPlatform = Exclude<SocialPlatform, RetiredComposerPlatform>

/** The networks the composer offers, in the order the picker shows them. */
export const COMPOSER_PLATFORMS: readonly ComposerPlatform[] = SOCIAL_PLATFORMS.filter(
  (platform): platform is ComposerPlatform =>
    !(RETIRED_COMPOSER_PLATFORMS as readonly string[]).includes(platform),
)

/**
 * Whether this network may be shown in the composer at all.
 *
 * Takes a plain string and answers a plain boolean on purpose. What arrives is
 * a connected account's provider name — whatever the posting connection called
 * it — or a `PostPlatform`, which is a wider union than this one. A narrowing
 * predicate would have to reject every caller whose input can also be a network
 * we deliver to but do not compose for, which is most of them.
 */
export function isComposerPlatform(platform: string): boolean {
  return (COMPOSER_PLATFORMS as readonly string[]).includes(platform)
}

/**
 * Every network the publisher accepts, including the nine NRS does not
 * dispatch to yet.
 *
 * Kept separate from the record above because that one is keyed by
 * `SocialPlatform`, the six-member union the dispatcher is built on. Widening
 * that union is a publishing decision and belongs with the publisher, not with
 * a table of field names.
 */
export const ZERNIO_PLATFORM_OPTION_KEYS: Record<string, readonly string[]> = {
  ...Object.fromEntries(
    Object.entries(SOCIAL_PLATFORM_CAPABILITIES).map(([platform, capability]) => [
      platform,
      capability.optionKeys,
    ]),
  ),
  threads: ['threadItems'],
  bluesky: ['langs', 'threadItems'],
  pinterest: ['title', 'boardId', 'link', 'coverImageUrl', 'coverImageKeyFrameTime'],
  reddit: [
    'subreddit', 'title', 'url', 'forceSelf', 'flairId', 'flairText',
    'nsfw', 'spoiler', 'sendreplies', 'nativeVideo', 'videogif', 'videoPosterUrl',
  ],
  telegram: ['parseMode', 'disableWebPagePreview', 'disableNotification', 'protectContent'],
  snapchat: ['contentType'],
  googlebusiness: ['locationId', 'languageCode', 'topicType', 'callToAction', 'event', 'offer'],
  discord: [
    'channelId', 'embeds', 'poll', 'crosspost', 'forumThreadName',
    'forumAppliedTags', 'threadFromMessage', 'tts',
  ],
  slack: ['threadTs', 'unfurlLinks', 'unfurlMedia', 'username', 'iconUrl'],
}

/** Networks that take a first comment under the post. */
export const FIRST_COMMENT_PLATFORMS: readonly string[] = [
  'instagram', 'facebook', 'linkedin', 'youtube',
]

export function socialPlatformCapability(platform: string): PlatformCapability | null {
  return (SOCIAL_PLATFORM_CAPABILITIES as Record<string, PlatformCapability>)[platform] ?? null
}
