import type { ZernioAccount } from '@/lib/zernio/client'

/**
 * The dashboard's connected-accounts list for one brand.
 *
 * Writes already go through `publishToPlatform` (Zernio first when the brand
 * carries a profile). The overview used to ignore that and always ask Mixpost,
 * so Scent Sell and EndorseMe published on Zernio and then the dashboard said
 * nothing was connected. Isolation is still ours: the caller must pass the
 * already-scoped Zernio list, never the team's whole set.
 */

export interface StudioOverviewAccount {
  platform: string
  accountName: string
  provider: 'zernio' | 'mixpost'
}

export function zernioProfileIdFromSocialUrls(socialUrls: unknown): string | null {
  if (!socialUrls || typeof socialUrls !== 'object') return null
  const raw = (socialUrls as Record<string, unknown>).zernio_profile_id
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

export function mapZernioAccountsForOverview(accounts: ZernioAccount[]): StudioOverviewAccount[] {
  return accounts.map((account) => ({
    platform: account.platform,
    accountName: account.displayName || account.username || account.platform,
    provider: 'zernio',
  }))
}
