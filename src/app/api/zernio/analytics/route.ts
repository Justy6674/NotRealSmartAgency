import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAnalytics } from '@/lib/zernio/client'

export const dynamic = 'force-dynamic'

/**
 * Daily social metrics for ONE brand the signed-in person owns.
 *
 * This route used to run on the service-role key, which bypasses Row Level
 * Security completely, with `brandId` read straight out of the query string and
 * nothing at all asked about the caller. Anyone holding a brand uuid could read
 * that tenant's reach, engagement and follower figures.
 *
 * The shape is copied from /api/zernio/ads, one directory over: session client,
 * `auth.getUser`, then a brand lookup filtered by `user_id`, so a brand id from
 * another workspace matches no row and the route stops there. The service role
 * is not used at all now — an owner reading their own brand needs nothing RLS
 * would refuse.
 *
 * 401 means nobody is signed in; 403 means someone is and this brand is not
 * theirs. 403 also covers "no such brand" so that ids cannot be enumerated.
 * Membership is decided by `zernioProfileForBrand` in src/lib/auth, which
 * honours an accepted team admin exactly as /api/brands and the Desk do.
 *
 * `reachable` and `problem` are additions, alongside the existing `configured`
 * and `metrics`. `fetchZernioAnalytics` returns null both when Zernio does not
 * answer and when there is no key on this deployment, and a null read is not
 * the same thing as a quiet week.
 */

const NOT_SIGNED_IN =
  'You are not signed in, so no figures could be read. Sign in and try again.'

const NOT_YOURS =
  'That brand could not be opened under this sign-in, so no figures were read.'

const NOT_SET_UP =
  'This site has no Zernio connection configured, so no figures can be read for any brand.'

const UNREACHABLE =
  'Zernio did not answer, so the figures below could not be read. Nothing has been changed. Try again in a moment.'

/** What the browser sees. `problem` is written for the owner, never upstream's words. */
interface AnalyticsPayload {
  /** True when this brand is linked to a Zernio profile. */
  configured: boolean
  /** True when Zernio answered. Null when there was nothing to ask. */
  reachable: boolean | null
  problem: string | null
  metrics: unknown
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    const platform = searchParams.get('platform') ?? undefined
    const fromDate = searchParams.get('fromDate') ?? undefined
    const toDate = searchParams.get('toDate') ?? undefined

    if (!brandId) {
      return NextResponse.json(
        { error: 'Choose a brand first — figures are kept per brand.' },
        { status: 400 },
      )
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') {
      return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
    }

    if (access.brand.profileId === null) {
      // Linked to nothing. A real answer about a brand this person owns.
      const payload: AnalyticsPayload = {
        configured: false,
        reachable: null,
        problem: null,
        metrics: null,
      }
      return NextResponse.json(payload)
    }

    if (!process.env.ZERNIO_API_KEY) {
      const payload: AnalyticsPayload = {
        configured: true,
        reachable: false,
        problem: NOT_SET_UP,
        metrics: null,
      }
      return NextResponse.json(payload)
    }

    const metrics = await fetchZernioAnalytics({
      profileId: access.brand.profileId,
      platform,
      fromDate,
      toDate,
    })

    const payload: AnalyticsPayload = {
      configured: true,
      reachable: metrics !== null,
      problem: metrics === null ? UNREACHABLE : null,
      metrics,
    }
    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/zernio/analytics GET',
          err,
          'The figures could not be read just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }
}
