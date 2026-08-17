import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAccounts } from '@/lib/zernio/client'

export const dynamic = 'force-dynamic'

/**
 * The social accounts connected to ONE brand the signed-in person owns.
 *
 * This route used to run on the service-role key — which bypasses Row Level
 * Security entirely — with `brandId` taken straight from the query string and
 * no check of any kind on the caller. Anyone who could reach the URL with a
 * brand uuid was handed that tenant's connected accounts: platforms, handles
 * and display names. There was no session, no API key, nothing.
 *
 * The shape is copied from /api/zernio/ads, one directory over, which does the
 * same job correctly: session client, `auth.getUser`, then a brand lookup
 * filtered by `user_id` so an unowned brand id matches no row.
 *
 * The service role is gone rather than merely gated. A signed-in owner reading
 * their own brand needs nothing that RLS would refuse them.
 *
 * 401 and 403 are deliberately different answers: 401 is "nobody is signed in",
 * 403 is "someone is, and this brand is not theirs". 403 also covers "no such
 * brand" on purpose — telling those apart would let a signed-in person work out
 * which brand ids exist.
 *
 * Who counts as "theirs" is decided by `zernioProfileForBrand` in src/lib/auth,
 * not restated here. It honours an accepted team admin the same way /api/brands
 * and the Desk do — this route being owner-only meant such a person saw an
 * empty accounts list with nothing on screen to explain it.
 */

const NOT_SIGNED_IN =
  'You are not signed in, so no accounts could be read. Sign in and try again.'

const NOT_YOURS =
  'That brand could not be opened under this sign-in, so no accounts were read.'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const brandId = new URL(request.url).searchParams.get('brandId')
    if (!brandId) {
      return NextResponse.json(
        { error: 'Choose a brand first — connected accounts are kept per brand.' },
        { status: 400 },
      )
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') {
      return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
    }

    // Linked to no Zernio profile, or no Zernio on this deployment at all.
    // Both are real answers about a brand this person owns, not failures.
    if (access.brand.profileId === null || !process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ accounts: [] })
    }

    const accounts = await fetchZernioAccounts(access.brand.profileId)
    return NextResponse.json({ accounts })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/zernio/accounts GET',
          err,
          'The connected accounts could not be read just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }
}
