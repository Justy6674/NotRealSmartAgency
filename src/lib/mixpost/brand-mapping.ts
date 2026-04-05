/**
 * Maps Mixpost connected accounts to NRS brands using fuzzy name matching.
 * Supports manual overrides via confirmed account IDs stored in social_urls.
 */

import type { MixpostAccount } from './client'
import { friendlyProvider } from './client'

interface BrandStub {
  id: string
  name: string
  slug: string
  social_urls?: Record<string, string>
}

/**
 * Read confirmed Mixpost account IDs from a brand's social_urls.
 * Stored as JSON-encoded number array under the key `mixpost_account_ids`.
 * Returns an empty array if no confirmed IDs are set.
 */
export function getConfirmedAccountIds(brand: BrandStub): number[] {
  const raw = brand.social_urls?.mixpost_account_ids
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((id): id is number => typeof id === 'number')
    return []
  } catch {
    return []
  }
}

export interface BrandSocialMapping {
  platform: string      // friendly name: "Instagram", "Facebook", etc.
  accountName: string   // Mixpost account display name
  provider: string      // raw provider key
}

/**
 * Normalise a string for comparison: lowercase, strip punctuation, collapse whitespace.
 */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Known aliases — Mixpost account names that don't fuzzy-match well.
 * Key: normalised Mixpost account name. Value: normalised brand name.
 */
const ALIASES: Record<string, string> = {
  scentswap: 'scentsell',
  scentsellsocials: 'scentsell',
  downscaleweightloss: 'downscaleweightloss',
  downscaleweightlossclinic: 'downscaleweightloss',
  downscalederm: 'downscalederm',
  downscaledermbrisband: 'downscalederm',
  downscaledermbrisbane: 'downscalederm',
  telescribeaustralia: 'telescribe',
  manclinicaustraliahealthcareformen: 'manclinic',
  endorseme: 'endorseme',
  justinblack: '', // personal LinkedIn — skip (no brand match)
}

/**
 * Map Mixpost accounts → brands.
 * Returns a record keyed by brand ID, each value is an array of connected platforms.
 */
export function mapMixpostAccountsToBrands(
  accounts: MixpostAccount[],
  brands: BrandStub[],
): Record<string, BrandSocialMapping[]> {
  const result: Record<string, BrandSocialMapping[]> = {}
  const accountsById = new Map(accounts.map(a => [a.id, a]))

  // 1. First pass: assign accounts that have confirmed (manual) mappings
  const claimedAccountIds = new Set<number>()

  for (const brand of brands) {
    const confirmedIds = getConfirmedAccountIds(brand)
    if (confirmedIds.length === 0) continue

    for (const id of confirmedIds) {
      const account = accountsById.get(id)
      if (!account) continue
      claimedAccountIds.add(id)
      if (!result[brand.id]) result[brand.id] = []
      result[brand.id].push({
        platform: friendlyProvider(account.provider),
        accountName: account.name,
        provider: account.provider,
      })
    }
  }

  // 2. Second pass: fuzzy-match remaining unclaimed accounts
  const brandLookup = brands.map(b => ({
    ...b,
    norm: normalise(b.name),
    normSlug: normalise(b.slug),
  }))
  // Only brands without confirmed IDs participate in fuzzy matching
  const brandsWithConfirmed = new Set(
    brands.filter(b => getConfirmedAccountIds(b).length > 0).map(b => b.id)
  )

  for (const account of accounts) {
    if (claimedAccountIds.has(account.id)) continue // already assigned

    const normAccount = normalise(account.name)
    const normUsername = account.username ? normalise(account.username) : ''

    // Check aliases first
    const aliasTarget = ALIASES[normAccount] ?? ALIASES[normUsername]
    if (aliasTarget === '') continue // explicitly skipped (e.g. personal LinkedIn)

    let matchedBrand: (typeof brandLookup)[number] | undefined

    if (aliasTarget) {
      matchedBrand = brandLookup.find(b => b.norm === aliasTarget || b.normSlug === aliasTarget)
    }

    // Substring match on brand name/slug within account name or username
    if (!matchedBrand) {
      matchedBrand = brandLookup.find(b =>
        (b.norm.length >= 4 && (normAccount.includes(b.norm) || normUsername.includes(b.norm))) ||
        (b.normSlug.length >= 4 && (normAccount.includes(b.normSlug) || normUsername.includes(b.normSlug)))
      )
    }

    // Reverse: account name within brand name
    if (!matchedBrand && normAccount.length >= 5) {
      matchedBrand = brandLookup.find(b =>
        b.norm.includes(normAccount) || b.normSlug.includes(normAccount)
      )
    }

    // Skip fuzzy match if this brand already has confirmed accounts
    if (matchedBrand && brandsWithConfirmed.has(matchedBrand.id)) continue

    if (matchedBrand) {
      if (!result[matchedBrand.id]) result[matchedBrand.id] = []
      result[matchedBrand.id].push({
        platform: friendlyProvider(account.provider),
        accountName: account.name,
        provider: account.provider,
      })
    }
  }

  return result
}

/**
 * Same matching logic as mapMixpostAccountsToBrands, but returns the raw
 * MixpostAccount objects per brand — needed by the publisher to resolve
 * account IDs for the Mixpost API.
 */
export function mapAccountsToBrandsRaw(
  accounts: MixpostAccount[],
  brands: BrandStub[],
): Map<string, MixpostAccount[]> {
  const result = new Map<string, MixpostAccount[]>()
  const accountsById = new Map(accounts.map(a => [a.id, a]))

  // 1. First pass: assign accounts that have confirmed (manual) mappings
  const claimedAccountIds = new Set<number>()

  for (const brand of brands) {
    const confirmedIds = getConfirmedAccountIds(brand)
    if (confirmedIds.length === 0) continue

    for (const id of confirmedIds) {
      const account = accountsById.get(id)
      if (!account) continue
      claimedAccountIds.add(id)
      const existing = result.get(brand.id) ?? []
      existing.push(account)
      result.set(brand.id, existing)
    }
  }

  // 2. Second pass: fuzzy-match remaining unclaimed accounts
  const brandLookup = brands.map(b => ({
    ...b,
    norm: normalise(b.name),
    normSlug: normalise(b.slug),
  }))
  const brandsWithConfirmed = new Set(
    brands.filter(b => getConfirmedAccountIds(b).length > 0).map(b => b.id)
  )

  for (const account of accounts) {
    if (claimedAccountIds.has(account.id)) continue

    const normAccount = normalise(account.name)
    const normUsername = account.username ? normalise(account.username) : ''

    const aliasTarget = ALIASES[normAccount] ?? ALIASES[normUsername]
    if (aliasTarget === '') continue

    let matchedBrand: (typeof brandLookup)[number] | undefined

    if (aliasTarget) {
      matchedBrand = brandLookup.find(b => b.norm === aliasTarget || b.normSlug === aliasTarget)
    }

    if (!matchedBrand) {
      matchedBrand = brandLookup.find(b =>
        (b.norm.length >= 4 && (normAccount.includes(b.norm) || normUsername.includes(b.norm))) ||
        (b.normSlug.length >= 4 && (normAccount.includes(b.normSlug) || normUsername.includes(b.normSlug)))
      )
    }

    if (!matchedBrand && normAccount.length >= 5) {
      matchedBrand = brandLookup.find(b =>
        b.norm.includes(normAccount) || b.normSlug.includes(normAccount)
      )
    }

    // Skip fuzzy match if this brand already has confirmed accounts
    if (matchedBrand && brandsWithConfirmed.has(matchedBrand.id)) continue

    if (matchedBrand) {
      const existing = result.get(matchedBrand.id) ?? []
      existing.push(account)
      result.set(matchedBrand.id, existing)
    }
  }

  return result
}
