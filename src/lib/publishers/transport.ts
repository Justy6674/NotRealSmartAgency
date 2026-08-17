import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { fetchZernioAccounts } from '@/lib/zernio/client'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'

export type PublisherTransport = 'zernio' | 'mixpost'

export const JUSTIN_OWNER_EMAIL = 'downscale@icloud.com'

export { zernioProfileIdFromSocialUrls }

/**
 * D14. Default zernio when a profile is set, else mixpost.
 * Missing key is the default — do not invent a brands column.
 */
export function publisherTransportOf(socialUrls: unknown): PublisherTransport {
  const urls = (socialUrls ?? {}) as Record<string, unknown>
  const raw = urls.publisher_transport
  if (raw === 'mixpost' || raw === 'zernio') return raw
  return zernioProfileIdFromSocialUrls(urls) ? 'zernio' : 'mixpost'
}

export function postingPausedOf(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false
  return (metadata as Record<string, unknown>).posting_paused === true
}

export function accountIdsFromMetadata(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== 'object') return []
  const ids = (metadata as Record<string, unknown>).account_ids
  if (!Array.isArray(ids)) return []
  return ids.filter((id): id is string => typeof id === 'string' && id.trim() !== '')
}

export function captionForAccount(
  baseCaption: string,
  metadata: unknown,
  accountId: string,
): string {
  if (!metadata || typeof metadata !== 'object') return baseCaption
  const map = (metadata as Record<string, unknown>).captions_by_account_id
  if (!map || typeof map !== 'object') return baseCaption
  const override = (map as Record<string, unknown>)[accountId]
  return typeof override === 'string' && override.trim() !== '' ? override : baseCaption
}

export const OWNER_NO_TICK = 'No account ticked for this network.'
export const OWNER_ACCOUNT_MISSING = 'That account isn’t connected for this business.'
export const OWNER_POSTING_PAUSED = 'Posting is paused until billing is live again.'

/**
 * Director tool has no tick UI. Use stored ticks, else the only account
 * this brand has on that network. Many accounts → fail closed (D7).
 */
export async function resolveDirectorAccountIds(opts: {
  brandId: string
  platform: string
  socialUrls: unknown
  metadata?: unknown
  brandName?: string
  brandSlug?: string
}): Promise<string[] | { error: string }> {
  const existing = accountIdsFromMetadata(opts.metadata)
  if (existing.length > 0) return existing

  const transport = publisherTransportOf(opts.socialUrls)
  const profileId = zernioProfileIdFromSocialUrls(opts.socialUrls)

  if (transport === 'zernio' && profileId) {
    const accounts = await fetchZernioAccounts(profileId)
    const matches = accounts.filter((a) => a.platform === opts.platform)
    if (matches.length === 1) return [matches[0]!.id]
    return { error: OWNER_NO_TICK }
  }

  const accounts = (await fetchMixpostAccounts()) ?? []
  const mapping = mapAccountsToBrandsRaw(accounts, [
    {
      id: opts.brandId,
      name: opts.brandName ?? '',
      slug: opts.brandSlug ?? '',
      social_urls: (opts.socialUrls ?? {}) as Record<string, unknown>,
    },
  ])
  const brandAccounts = mapping.get(opts.brandId) ?? []
  const matches = brandAccounts.filter(
    (a) => canonicalSocialPlatform(a.provider) === opts.platform,
  )
  if (matches.length === 1) return [String(matches[0]!.id)]
  return { error: OWNER_NO_TICK }
}
