/**
 * Which social accounts a project can actually post to.
 *
 * Asked because the Director offered TikTok for Scent Sell, which has never
 * had a TikTok account connected. Offering a platform that is not there is
 * worse than not offering it: the owner answers "all of them", and either the
 * post silently never appears or the whole draft fails on the one account that
 * does not exist.
 *
 * The answer comes from Mixpost, which is the only thing that knows. A list
 * kept anywhere else drifts the moment an account is added or revoked.
 */

import { fetchMixpostAccounts } from './client'
import { getConfirmedAccountIds, type BrandStub } from './brand-mapping'

/** How a platform should be named to a person. */
const LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook_page: 'Facebook',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  twitter: 'X',
  mastodon: 'Mastodon',
  pinterest: 'Pinterest',
  threads: 'Threads',
}

export interface ConnectedAccount {
  accountId: number
  provider: string
  label: string
  handle: string
}

/**
 * The project's live accounts, newest Mixpost state.
 *
 * An id on the brand that no longer matches an account is dropped rather than
 * guessed at — Mixpost reuses numbers, so a stale id is not merely dead, it is
 * a way to post one brand's content to another brand's page.
 */
export async function connectedAccounts(brand: BrandStub): Promise<ConnectedAccount[]> {
  const wanted = new Set(getConfirmedAccountIds(brand))
  if (wanted.size === 0) return []

  const accounts = await fetchMixpostAccounts().catch(() => [])
  const live: ConnectedAccount[] = []

  for (const account of accounts as Array<{ id: number | string; provider?: string; name?: string }>) {
    const id = Number(account.id)
    if (!wanted.has(id)) continue
    const provider = String(account.provider ?? '')
    live.push({
      accountId: id,
      provider,
      label: LABELS[provider] ?? provider,
      handle: String(account.name ?? ''),
    })
  }

  return live.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
}

/** Just the names, for putting to a person: "Instagram, Facebook and YouTube". */
export function platformNames(accounts: readonly ConnectedAccount[]): string[] {
  return [...new Set(accounts.map((account) => account.label))]
}
