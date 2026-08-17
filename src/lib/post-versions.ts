import type { PostPlatform } from '@/types/database'

/**
 * Post Versions — per-platform content customisation.
 * A "master" caption syncs to all platforms. Per-platform overrides are opt-in.
 */

export interface PlatformVersion {
  caption: string
  hashtags: string[]
  isCustomised: boolean // false = uses master, true = has platform-specific override
}

export type PostVersions = Partial<Record<PostPlatform, PlatformVersion>>

export function createVersionsFromMaster(
  platforms: PostPlatform[],
  masterCaption: string,
  masterHashtags: string[]
): PostVersions {
  const versions: PostVersions = {}
  for (const platform of platforms) {
    versions[platform] = {
      caption: masterCaption,
      hashtags: [...masterHashtags],
      isCustomised: false,
    }
  }
  return versions
}

export function updateMasterCaption(
  versions: PostVersions,
  caption: string,
  hashtags: string[]
): PostVersions {
  const updated: PostVersions = {}
  for (const [platform, version] of Object.entries(versions)) {
    if (version.isCustomised) {
      // Keep customised version unchanged
      updated[platform as PostPlatform] = version
    } else {
      // Sync from master
      updated[platform as PostPlatform] = { caption, hashtags: [...hashtags], isCustomised: false }
    }
  }
  return updated
}

export function customisePlatform(
  versions: PostVersions,
  platform: PostPlatform,
  caption: string,
  hashtags: string[]
): PostVersions {
  return {
    ...versions,
    [platform]: { caption, hashtags, isCustomised: true },
  }
}

export function resetPlatformToMaster(
  versions: PostVersions,
  platform: PostPlatform,
  masterCaption: string,
  masterHashtags: string[]
): PostVersions {
  return {
    ...versions,
    [platform]: { caption: masterCaption, hashtags: [...masterHashtags], isCustomised: false },
  }
}

/**
 * What a given platform actually publishes. Shaped like PlatformVersion so it
 * can stand in wherever one was expected.
 */
export interface ResolvedPublishContent {
  caption: string
  hashtags: string[]
  isCustomised: boolean
}

/**
 * THE FAULT: a user rewrote the Instagram caption, watched the preview redraw
 * with a "customised" badge under it, pressed Save — and Instagram received the
 * master caption. The per-platform text was written by the editor and read by
 * nobody. Both halves of the screen were sincere; the preview read the version
 * and the save handler read the master, and neither knew the other existed.
 *
 * Threading the version through the save handler would have fixed that screen.
 * It would not have fixed anything else: the next surface to grow a Save button
 * starts from the master again, because nothing says it must not. So the rule
 * lives here, once, and the preview and every publish path call it. Two
 * surfaces that ask the same function cannot answer differently.
 *
 * Three rules that are not obvious, each of which was a live way to publish the
 * wrong words:
 *
 * 1. A version that is NOT customised is ignored entirely — the master wins,
 *    the stored copy is never trusted. It goes stale: PostCreator only calls
 *    updateMasterCaption when more than one platform is ticked, so with a
 *    single platform the copy still holds whatever the user typed first.
 *
 * 2. A customisation the user emptied is not a customisation. Selecting the
 *    platform caption and hitting delete leaves isCustomised true with nothing
 *    behind it; honouring that flag literally publishes a blank post to a live
 *    account. Falling back publishes the words still visible on the master tab.
 *    Padding is preserved — trimming is the publisher's business, and silently
 *    rewriting someone's caption is how this whole thing felt to begin with.
 *
 * 3. Hashtags follow the caption's verdict and are never independently topped
 *    up from the master. PlatformVersionEditor carries the current tags into
 *    customisePlatform, so an empty array on a customised platform is a
 *    decision. Falling back there would put #weightloss back on a LinkedIn post
 *    the user had just stripped it from.
 *
 * Caption and hashtags stay separate. The publishers compose them — the cron
 * adds the '#' and joins — so composing here would produce '##tag' downstream.
 */
export function resolvePublishCaption(
  versions: PostVersions | null | undefined,
  platform: PostPlatform,
  masterCaption: string,
  masterHashtags: readonly string[] | null | undefined
): ResolvedPublishContent {
  // Copied on the way out. The result is handed to a request body and to a
  // render; a caller that pushed onto it would be editing stored state.
  const master: ResolvedPublishContent = {
    caption: masterCaption,
    hashtags: [...(masterHashtags ?? [])],
    isCustomised: false,
  }

  const version = versions?.[platform]
  if (!version?.isCustomised) return master
  if (typeof version.caption !== 'string' || version.caption.trim() === '') return master

  return {
    caption: version.caption,
    // `versions` is stored as JSON, so a row written before hashtags existed
    // reads back null and the publish loop calls .map on it.
    hashtags: [...(version.hashtags ?? [])],
    isCustomised: true,
  }
}

/**
 * What the preview grew up calling. Kept as a name, not as a second opinion —
 * a separate copy of the rule here is precisely how the badge and the published
 * post came to disagree.
 */
export function getVersionForPlatform(
  versions: PostVersions,
  platform: PostPlatform,
  masterCaption: string,
  masterHashtags: string[]
): PlatformVersion {
  return resolvePublishCaption(versions, platform, masterCaption, masterHashtags)
}

export const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  twitter: 280,
  tiktok: 2200,
  youtube: 5000,
  bluesky: 300,
  mastodon: 500,
  pinterest: 500,
  threads: 500,
  google_business: 1500,
}
