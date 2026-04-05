/**
 * Maps Mixpost connected accounts to NRS brands using fuzzy name matching.
 */

import type { MixpostAccount } from './client'
import { friendlyProvider } from './client'

interface BrandStub {
  id: string
  name: string
  slug: string
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

  // Pre-compute normalised brand names for matching
  const brandLookup = brands.map(b => ({
    ...b,
    norm: normalise(b.name),
    normSlug: normalise(b.slug),
  }))

  for (const account of accounts) {
    const normAccount = normalise(account.name)
    const normUsername = account.username ? normalise(account.username) : ''

    // 1. Check aliases first
    const aliasTarget = ALIASES[normAccount] ?? ALIASES[normUsername]
    if (aliasTarget === '') continue // explicitly skipped (e.g. personal LinkedIn)

    let matchedBrand: BrandStub | undefined

    if (aliasTarget) {
      matchedBrand = brandLookup.find(b => b.norm === aliasTarget || b.normSlug === aliasTarget)
    }

    // 2. Substring match on brand name/slug within account name or username
    if (!matchedBrand) {
      matchedBrand = brandLookup.find(b =>
        (b.norm.length >= 4 && (normAccount.includes(b.norm) || normUsername.includes(b.norm))) ||
        (b.normSlug.length >= 4 && (normAccount.includes(b.normSlug) || normUsername.includes(b.normSlug)))
      )
    }

    // 3. Reverse: account name within brand name
    if (!matchedBrand && normAccount.length >= 5) {
      matchedBrand = brandLookup.find(b =>
        b.norm.includes(normAccount) || b.normSlug.includes(normAccount)
      )
    }

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

  const brandLookup = brands.map(b => ({
    ...b,
    norm: normalise(b.name),
    normSlug: normalise(b.slug),
  }))

  for (const account of accounts) {
    const normAccount = normalise(account.name)
    const normUsername = account.username ? normalise(account.username) : ''

    // 1. Check aliases first
    const aliasTarget = ALIASES[normAccount] ?? ALIASES[normUsername]
    if (aliasTarget === '') continue

    let matchedBrand: BrandStub | undefined

    if (aliasTarget) {
      matchedBrand = brandLookup.find(b => b.norm === aliasTarget || b.normSlug === aliasTarget)
    }

    // 2. Substring match
    if (!matchedBrand) {
      matchedBrand = brandLookup.find(b =>
        (b.norm.length >= 4 && (normAccount.includes(b.norm) || normUsername.includes(b.norm))) ||
        (b.normSlug.length >= 4 && (normAccount.includes(b.normSlug) || normUsername.includes(b.normSlug)))
      )
    }

    // 3. Reverse: account name within brand name
    if (!matchedBrand && normAccount.length >= 5) {
      matchedBrand = brandLookup.find(b =>
        b.norm.includes(normAccount) || b.normSlug.includes(normAccount)
      )
    }

    if (matchedBrand) {
      const existing = result.get(matchedBrand.id) ?? []
      existing.push(account)
      result.set(matchedBrand.id, existing)
    }
  }

  return result
}
