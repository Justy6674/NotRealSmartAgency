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

export function getVersionForPlatform(
  versions: PostVersions,
  platform: PostPlatform,
  masterCaption: string,
  masterHashtags: string[]
): PlatformVersion {
  const version = versions[platform]
  if (version?.isCustomised) return version
  return { caption: masterCaption, hashtags: [...masterHashtags], isCustomised: false }
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
}
