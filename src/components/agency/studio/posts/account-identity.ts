import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'
import type { SocialPostAccount } from '@/hooks/usePostsList'

/**
 * How one account is named to the owner, everywhere it is listed.
 *
 * Two of this owner's accounts are both called "Scent Sell" — a Facebook page
 * and an Instagram account. The publisher's display name is the same string for
 * both, so a list showing only the name asks the owner to pick between two
 * identical rows. The network beside it does not settle it either, once a
 * business has two pages on one network.
 *
 * The handle is the thing that is unique, so the handle is always shown when
 * the publisher reports one. Nothing here invents a handle: an account with
 * none falls back to its network, which is all that is known.
 */

/** `@scentsellsocials`, or the network when no handle came back. */
export function accountHandle(account: SocialPostAccount): string {
  const username = account.username?.trim()
  if (!username) return ownerFacingPlatformLabel(account.platform)
  return username.startsWith('@') ? username : `@${username}`
}

/** `Scent Sell · @scentsellsocials` — the full line, for a tooltip or a menu. */
export function accountIdentityLine(account: SocialPostAccount): string {
  const handle = accountHandle(account)
  const name = account.name?.trim() || handle
  const platform = ownerFacingPlatformLabel(account.platform)
  if (handle === platform) return `${name} · ${platform}`
  if (name === handle) return `${handle} · ${platform}`
  return `${name} · ${handle} · ${platform}`
}
