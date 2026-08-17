/**
 * Which social accounts a project can actually post to.
 *
 * Asked because the Director offered TikTok for Scent Sell, which has never
 * had a TikTok account connected. Offering a platform that is not there is
 * worse than not offering it: the owner answers "all of them", and either the
 * post silently never appears or the whole draft fails on the one account that
 * does not exist.
 *
 * A linked brand is answered from its own publisher accounts (filtered in
 * our code). Mixpost is the fallback for every other brand, and only the
 * confirmed ids on that brand — Mixpost's workspace list is not a brand list.
 */

import { fetchMixpostAccounts } from './client'
import { getConfirmedAccountIds, type BrandStub } from './brand-mapping'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { fetchZernioAccounts } from '@/lib/zernio/client'
import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'

export interface ConnectedAccount {
  accountId: string
  provider: string
  label: string
  handle: string
}

export async function connectedAccounts(brand: BrandStub): Promise<ConnectedAccount[]> {
  const profileId = zernioProfileIdFromSocialUrls(brand.social_urls)
  if (profileId) {
    const accounts = await fetchZernioAccounts(profileId)
    return accounts
      .map((account) => ({
        accountId: account.id,
        provider: account.platform,
        label: ownerFacingPlatformLabel(account.platform),
        handle: account.displayName || account.username || account.platform,
      }))
      .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
  }

  const wanted = new Set(getConfirmedAccountIds(brand))
  if (wanted.size === 0) return []

  const accounts = await fetchMixpostAccounts().catch(() => [])
  const live: ConnectedAccount[] = []

  for (const account of accounts as Array<{ id: number | string; provider?: string; name?: string }>) {
    const id = Number(account.id)
    if (!wanted.has(id)) continue
    const provider = String(account.provider ?? '')
    live.push({
      accountId: String(id),
      provider,
      label: ownerFacingPlatformLabel(provider),
      handle: String(account.name ?? ''),
    })
  }

  return live.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
}

/** Just the names, for putting to a person: "Instagram, Facebook and YouTube". */
export function platformNames(accounts: readonly ConnectedAccount[]): string[] {
  return [...new Set(accounts.map((account) => account.label))]
}
