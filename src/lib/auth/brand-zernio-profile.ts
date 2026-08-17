import type { SupabaseClient } from '@supabase/supabase-js'
import { BrandWorkspaceAccessError, resolveBrandWorkspaceContext } from './brand-workspace'

/**
 * One rule for who may act on a brand's Zernio connection, in one place.
 *
 * Every Zernio route grew its own private copy of `profileIdForOwnedBrand`,
 * each doing `.eq('user_id', user.id)` — owner only. That closed the hole the
 * routes had (no caller check at all), but it left the workspace contradicting
 * itself: /api/brands, /api/chat, /api/conversations and /api/desk all honour an
 * accepted team member with the owner or admin role, because the database's own
 * write policy (`can_write_for_owner`) does. So the same person could open and
 * save every settings screen for a brand and then be refused its connected
 * accounts — with no error shown, because useSocialAccounts only merges the
 * Zernio list `if (zernioRes.ok)`. An empty list is not an explanation.
 *
 * The membership rule is therefore not restated here. It is
 * `resolveBrandWorkspaceContext`, the same function the Desk and chat routes
 * use, which is stricter than the brands route in one way worth knowing: a team
 * member whose `brand_ids` names specific brands is held to that list rather
 * than the whole workspace. Stricter is the right direction for a route that
 * spends a shared credential.
 *
 * `denied` deliberately covers both "no such brand" and "not yours". Telling
 * those apart would let a signed-in person work out which brand ids exist.
 */

export interface BrandZernioContext {
  brandId: string
  brandName: string
  /** The workspace owner, which is NOT the caller when a team member is acting. */
  workspaceOwnerId: string
  /** The whole `social_urls` record, so a caller updating it can merge rather than replace. */
  socialUrls: Record<string, unknown>
  /** The brand's Zernio profile, or null when it has never been linked. */
  profileId: string | null
}

export type BrandZernioAccess =
  | { access: 'denied' }
  | { access: 'granted'; brand: BrandZernioContext }

export async function zernioProfileForBrand(
  supabase: SupabaseClient,
  actorUserId: string,
  brandId: string,
): Promise<BrandZernioAccess> {
  try {
    const { brand, workspaceOwnerId } = await resolveBrandWorkspaceContext<{
      id: string
      user_id: string
      name: string | null
      social_urls: Record<string, unknown> | null
    }>(supabase, actorUserId, brandId)

    const socialUrls = (brand.social_urls ?? {}) as Record<string, unknown>
    const raw = socialUrls.zernio_profile_id

    return {
      access: 'granted',
      brand: {
        brandId: brand.id,
        brandName: typeof brand.name === 'string' && brand.name.trim() !== '' ? brand.name : 'Brand',
        workspaceOwnerId,
        socialUrls,
        profileId: typeof raw === 'string' && raw.trim() !== '' ? raw : null,
      },
    }
  } catch (err) {
    // A refusal and a missing brand are the same answer on purpose. Anything
    // else is a real fault and belongs to the caller's try/catch.
    if (err instanceof BrandWorkspaceAccessError) return { access: 'denied' }
    throw err
  }
}
