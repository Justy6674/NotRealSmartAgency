/**
 * Every brand gets a publisher profile, and it is named after the brand ID.
 *
 * Depended on by: `/api/zernio/connect/start`.
 *
 * ── The twelve brands that could not connect anything ──────────────────
 *
 * `/api/zernio/connect` refuses outright when a brand has no
 * `social_urls.zernio_profile_id`, on the reasonable ground that creating a
 * profile from an unlinked brand was how a service-role route once wrote a
 * fresh profile onto somebody else's row. The reasonable rule left twelve of
 * the brands in this workspace permanently unable to connect a single account,
 * with an error that reads like a bug because from the owner's side it is one:
 * "this business isn't set up to connect accounts yet", and nothing anywhere
 * says how to set it up.
 *
 * So the profile is created here — but only ever after the caller has proved
 * who is asking and that the brand is theirs (`zernioProfileForBrand`), and the
 * write goes through the SESSION client so RLS (`can_write_for_owner`) is the
 * thing that permits it. There is no admin client in this file, which is a
 * stronger position than having one behind a check.
 *
 * ── Why the name is a uuid and not "Downscale" ─────────────────────────
 *
 * Profile names are unique within a Zernio TEAM, and our team holds every
 * subscriber's profiles. Two customers both trading as "Bright Dental" is not a
 * hypothetical, and the second one would get a 409 they could do nothing about.
 * Worse, a human label is a guess at identity: a brand renamed in NRS would no
 * longer match its own profile, and the adoption path below would create a
 * second one. The internal brand id never changes and never collides, so it is
 * the name. The human label goes in `description`, where it is for reading and
 * nothing depends on it.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { BrandZernioContext } from '@/lib/auth/brand-zernio-profile'
import { messageOf } from '@/lib/errors/user-safe'
import { zernioConnectRequest } from './connect'
import { ZernioError } from './errors'

/** The one place the name is decided. Callers must not build their own. */
export function zernioProfileNameForBrand(brandId: string): string {
  return `nrs-${brandId}`
}

interface RawProfile {
  _id?: string
  id?: string
  name?: string
}

function profileIdOf(raw: RawProfile | null | undefined): string {
  const id = raw?.id ?? raw?._id
  return typeof id === 'string' ? id : ''
}

/**
 * Find the profile this brand's name already claims.
 *
 * Run BEFORE creating, and it is not an optimisation. A create that succeeded
 * upstream and then failed to save locally — a timeout, a deploy, a rolled-back
 * transaction — leaves a profile nobody can reach. Without this lookup every
 * retry makes another one, and the team's profile count climbs against a plan
 * limit for a brand that still cannot connect anything.
 */
async function findProfileByName(name: string): Promise<string> {
  const data = await zernioConnectRequest<{ profiles?: RawProfile[] }>(
    'profiles.listProfiles',
    '/profiles',
    { query: { name, limit: '50' } },
  )

  const exact = (data?.profiles ?? []).find((profile) => profile?.name === name)
  return profileIdOf(exact)
}

/**
 * The brand's profile id, creating one if this brand has never had it.
 *
 * `created` is returned rather than logged because the caller is a route that
 * can tell the owner "we set your business up on the posting service" once, and
 * never mention it again.
 */
export async function ensureBrandZernioProfile(
  supabase: SupabaseClient,
  brand: BrandZernioContext,
): Promise<{ profileId: string; created: boolean }> {
  if (brand.profileId) return { profileId: brand.profileId, created: false }

  const name = zernioProfileNameForBrand(brand.brandId)

  const existing = await findProfileByName(name)
  if (existing) {
    await persistProfileId(supabase, brand, existing)
    return { profileId: existing, created: false }
  }

  const created = await zernioConnectRequest<{ profile?: RawProfile }>(
    'profiles.createProfile',
    '/profiles',
    {
      method: 'POST',
      body: {
        name,
        // For a human reading the Zernio dashboard. Nothing keys off it, and it
        // is allowed to go stale when the brand is renamed here.
        description: brand.brandName,
      },
      headers: {
        /*
         * Deterministic, not random.
         *
         * Zernio replays the original response for the same key and the same
         * body, so two requests racing — a double-clicked button, a retried
         * serverless invocation — resolve to ONE profile instead of two. A fresh
         * uuid per attempt would make the header decorative.
         */
        'Idempotency-Key': `nrs-profile-${brand.brandId}`,
      },
    },
  )

  const profileId = profileIdOf(created?.profile)
  if (!profileId) {
    throw new ZernioError(
      'profiles.createProfile',
      'profiles.createProfile: the publisher created a profile but returned no id.',
    )
  }

  await persistProfileId(supabase, brand, profileId)
  return { profileId, created: true }
}

/**
 * Merge, never replace.
 *
 * `social_urls` is a shared bag — the brand's public links live in it, and so
 * does the billing-pause timestamp. Writing `{ zernio_profile_id }` alone would
 * silently delete every one of them, which is the kind of loss nobody notices
 * until a page renders without its Instagram link.
 */
async function persistProfileId(
  supabase: SupabaseClient,
  brand: BrandZernioContext,
  profileId: string,
): Promise<void> {
  const { error } = await supabase
    .from('brands')
    .update({ social_urls: { ...brand.socialUrls, zernio_profile_id: profileId } })
    .eq('id', brand.brandId)

  if (error) {
    /*
     * The profile exists upstream at this point and we could not write it down.
     * Throwing is right: returning it would let the caller start an OAuth flow
     * whose result lands on a profile this brand will never look at again. The
     * next attempt finds it by name above, so nothing is orphaned permanently.
     */
    throw new ZernioError(
      'zernio.profile.persist',
      `zernio.profile.persist: created ${profileId} for brand ${brand.brandId} but could not save it — ${messageOf(error)}`,
    )
  }
}
