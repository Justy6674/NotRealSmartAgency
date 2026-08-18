import type { SocialPostAccount } from '@/hooks/usePostsList'
import { accountIdsFromMetadata } from '@/lib/publishers/transport'
import { canonicalSocialPlatform } from '@/lib/studio/social-read-source'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { fetchZernioAccounts, type ZernioAccount } from '@/lib/zernio/client'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'

/**
 * Which accounts a Posts row is for — answered before it goes out, not after.
 *
 * The desk row used to carry `accounts: []` unconditionally, so every draft,
 * every scheduled post and every failure fell through to the platform-glyph
 * branch: a network mark, never the account. On the live Scent Sell business
 * that is 121 of 121 rows. Only published history — which arrives from the
 * publisher with its accounts attached — ever showed a real one, so the owner
 * could not see where a post was going until after it had gone, and the account
 * filter could only offer accounts that appeared in history. A business with
 * drafts and nothing published got an empty filter.
 *
 * ── Why this resolves the same way the publisher does ──────────────────
 * `resolveDirectorAccountIds` (publishers/transport.ts) is the rule that
 * actually decides where a post lands when the row carries no ticks: the one
 * account on that network, or nothing at all when there are several. This
 * mirrors it exactly. Showing an account here that the publisher would not
 * choose is a worse lie than showing a network mark, because it names a page
 * the post will never reach.
 */

export interface DeskConnectedAccount {
  id: string
  /** The publisher's own platform string, e.g. `facebook`, `facebook_page`. */
  platform: string
  name: string
  /** The handle. The only thing that separates two accounts named alike. */
  username: string | null
}

export interface DeskRowForAccounts {
  platform?: unknown
  metadata?: unknown
}

function toSocialPostAccount(account: DeskConnectedAccount): SocialPostAccount {
  return {
    id: account.id,
    platform: account.platform,
    name: account.name,
    ...(account.username ? { username: account.username } : {}),
  }
}

/**
 * The accounts to show on one desk row.
 *
 *  1. Ticked accounts win — `metadata.account_ids` is what the composer wrote
 *     and what `publishTickedAccounts` walks, so it is the truth of the row.
 *  2. Otherwise, the single connected account on that network, which is what
 *     the Director resolves to.
 *  3. Several accounts on the network and no ticks → nothing. The row genuinely
 *     does not say which, and the network mark is the honest answer.
 */
export function accountsForDeskRow(
  row: DeskRowForAccounts,
  connected: readonly DeskConnectedAccount[],
): SocialPostAccount[] {
  if (connected.length === 0) return []

  const ticked = accountIdsFromMetadata(row.metadata)
  if (ticked.length > 0) {
    const byId = new Map(connected.map((account) => [account.id, account]))
    // An id with no connected account behind it is a page that has since been
    // disconnected. It is dropped rather than drawn as an account that is still
    // there — the row falls back to its network mark, which is all that is left
    // that is true.
    return ticked
      .map((id) => byId.get(id))
      .filter((account): account is DeskConnectedAccount => account !== undefined)
      .map(toSocialPostAccount)
  }

  const platform = canonicalSocialPlatform(String(row.platform ?? ''))
  if (!platform) return []
  const matches = connected.filter(
    (account) => canonicalSocialPlatform(account.platform) === platform,
  )
  return matches.length === 1 ? [toSocialPostAccount(matches[0]!)] : []
}

export function deskAccountFromZernio(account: ZernioAccount): DeskConnectedAccount {
  return {
    id: account.id,
    platform: account.platform,
    name: account.displayName || account.username || account.platform,
    username: account.username ?? null,
  }
}

export interface BrandForAccounts {
  id: string
  name: string
  slug: string
  social_urls: unknown
}

/**
 * Every account this business can post from.
 *
 * A linked business is answered from its own publisher profile and never falls
 * through to the shared workspace list — that fallback ignores brandId, and
 * merging the two would put another business's pages on this desk. Same rule as
 * `ownerFacingAccounts`; it is a tenancy boundary, not a preference.
 *
 * `zernioAccounts` is passed in by callers that have already listed them (the
 * Posts route lists them once for published history), so reading the desk does
 * not cost two account listings.
 */
export async function connectedAccountsForBrand(
  brand: BrandForAccounts,
  opts: { zernioAccounts?: ZernioAccount[] | null } = {},
): Promise<DeskConnectedAccount[]> {
  const profileId = zernioProfileIdFromSocialUrls(brand.social_urls)

  if (profileId) {
    const accounts = opts.zernioAccounts ?? (await fetchZernioAccounts(profileId))
    return accounts.map(deskAccountFromZernio)
  }

  const workspace = (await fetchMixpostAccounts()) ?? []
  if (workspace.length === 0) return []
  const mapped = mapAccountsToBrandsRaw(workspace, [
    {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      social_urls: (brand.social_urls ?? {}) as Record<string, string>,
    },
  ])
  return (mapped.get(brand.id) ?? []).map((account) => ({
    id: String(account.id),
    platform: account.provider,
    name: account.name,
    username: account.username ?? null,
  }))
}
