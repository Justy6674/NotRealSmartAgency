import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'

/**
 * Which read backend a brand's owner-facing accounts/analytics should use.
 *
 * Writes already go through `publishToPlatform`. Reads used to always ask
 * Mixpost, which returns the whole workspace and ignores brandId — so a
 * Zernio-linked brand (Scent Sell, EndorseMe) was shown every other brand's
 * connected accounts. Isolation is ours: a linked brand never falls through
 * to that workspace list, even when its own list is empty. Justin does not
 * want Mixpost history on a linked brand.
 *
 * `linked` is the profile id on the brand, not whether Zernio answered.
 * A missing API key is an empty list, not a Mixpost dump.
 */

export function brandIsPublisherLinked(socialUrls: unknown): boolean {
  return zernioProfileIdFromSocialUrls(socialUrls) !== null
}

export function ownerFacingAccounts<TLinked, TMapped>(opts: {
  linked: boolean
  linkedAccounts: TLinked[]
  /** Already brand-mapped Mixpost accounts — never the whole workspace. */
  mixpostBrandAccounts: TMapped[]
}): TLinked[] | TMapped[] {
  if (opts.linked) return opts.linkedAccounts
  return opts.mixpostBrandAccounts
}

export function periodToDateRange(period: string): { fromDate: string; toDate: string } {
  const to = new Date()
  const from = new Date()
  const days = period === '90_days' ? 90 : period === '30_days' ? 30 : 7
  from.setDate(from.getDate() - days)
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  }
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  facebook_page: 'Facebook',
  facebook_group: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  linkedin_page: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  twitter: 'X',
  x: 'X',
  pinterest: 'Pinterest',
  threads: 'Threads',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
}

export function ownerFacingPlatformLabel(platform: string): string {
  const key = platform.trim().toLowerCase().replace(/_(page|group)$/, '')
  return PLATFORM_LABELS[platform.trim().toLowerCase()]
    ?? PLATFORM_LABELS[key]
    ?? (platform.trim() ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'Social')
}
