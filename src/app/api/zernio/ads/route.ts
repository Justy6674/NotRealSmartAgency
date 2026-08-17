import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import {
  fetchZernioAccounts,
  isZernioAdPlatform,
  listZernioCampaigns,
  setZernioCampaignStatus,
  type ZernioAdPlatform,
} from '@/lib/zernio/client'

export const dynamic = 'force-dynamic'

/**
 * Paid campaigns for ONE brand the signed-in person owns.
 *
 * Two things this route used to get wrong, both of which mattered.
 *
 * First, it ran on the service-role key with no session and no ownership check,
 * so anyone who could reach the URL with a brand uuid read that tenant's ad
 * spend — and could POST to pause their live campaigns. /api/inbox already had
 * the right pattern (session client, getUser, brand lookup scoped by user_id);
 * it is copied here rather than reinvented. `brandId` is now required, because
 * an unscoped list returns every campaign in the whole Zernio workspace.
 *
 * Second, an upstream failure was indistinguishable from an empty ledger. The
 * client returns a discriminated result now, and this route forwards the
 * difference — `reachable: false` with a plain sentence — so the page can say
 * "these figures could not be read" instead of "no campaigns running".
 *
 * The private `profileIdForOwnedBrand` helper this file used to carry is now
 * `zernioProfileForBrand` in src/lib/auth. Four Zernio routes had grown their
 * own copy of it, all of them owner-only, while the rest of the workspace
 * honours an accepted team admin — so a team admin could save a brand's
 * settings and be refused its ad spend. One helper, one rule.
 */

/** What the browser sees. `problem` is written for the owner, never upstream's words. */
interface AdsPayload {
  /** True when this brand is linked to a Zernio ad profile. */
  configured: boolean
  /** True when Zernio answered. Null when there was nothing to ask. */
  reachable: boolean | null
  problem: string | null
  campaigns: unknown[]
}

const UNREACHABLE =
  'Ads figures could not be read just now. Nothing has been changed. If a campaign should be running, check it in the platform’s Ads Manager.'

const NOT_SET_UP =
  'Ads are not set up for this site, so no campaign figures can be read for any brand.'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    const accountId = searchParams.get('accountId') ?? undefined

    if (!brandId) {
      return NextResponse.json(
        { error: 'Choose a brand first — ad spend is kept per brand.' },
        { status: 400 },
      )
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') {
      return NextResponse.json({ error: 'That brand could not be found.' }, { status: 404 })
    }
    if (access.brand.profileId === null) {
      // Linked to nothing. A real answer, not a failure.
      const payload: AdsPayload = { configured: false, reachable: null, problem: null, campaigns: [] }
      return NextResponse.json(payload)
    }

    /*
     * A narrowing filter is still an id from the caller, so it is checked
     * against this brand's own profile before it is forwarded.
     *
     * Zernio's multi-tenant guide is explicit that it does not do this for us:
     * "Posts validate accountId against your whole team, not against a profile
     * ... only pass a customer their own account IDs." Whether campaign listing
     * scopes the filter by profile is not documented either way, and an
     * undocumented assumption is not a control. The POST below already refuses
     * a campaign that is not in this profile; the read now matches it.
     */
    if (accountId) {
      const own = await fetchZernioAccounts(access.brand.profileId)
      if (!own.some((a) => a.id === accountId)) {
        return NextResponse.json(
          { error: 'That account is not connected to this brand, so no figures were read.' },
          { status: 404 },
        )
      }
    }

    const result = await listZernioCampaigns(access.brand.profileId, accountId)
    if (!result.ok) {
      const payload: AdsPayload = {
        configured: true,
        reachable: false,
        problem: result.reason === 'not_configured' ? NOT_SET_UP : UNREACHABLE,
        campaigns: [],
      }
      return NextResponse.json(payload)
    }

    const payload: AdsPayload = {
      configured: true,
      reachable: true,
      problem: null,
      campaigns: result.campaigns,
    }
    return NextResponse.json(payload)
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/zernio/ads GET',
          err,
          'The campaign figures could not be read just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as {
      brandId?: unknown
      campaignId?: unknown
      status?: unknown
      platform?: unknown
    }

    const brandId = typeof body.brandId === 'string' ? body.brandId : null
    const campaignId = typeof body.campaignId === 'string' ? body.campaignId : null
    const status = body.status === 'active' || body.status === 'paused' ? body.status : null

    if (!brandId || !campaignId || !status) {
      return NextResponse.json(
        { error: 'This campaign was not changed. The request was missing the brand, the campaign or the new status.' },
        { status: 400 },
      )
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied' || access.brand.profileId === null) {
      return NextResponse.json(
        { error: 'That campaign could not be changed, because that brand is not linked to an ad profile here.' },
        { status: 404 },
      )
    }
    const profileId = access.brand.profileId

    /**
     * Ownership is checked against Zernio, not against the request.
     *
     * A campaign id in the body proves nothing — the whole point of the leak
     * being fixed here is that one tenant could send another tenant's id. So
     * the campaign has to appear in this brand's own profile before a single
     * dollar of it can be stopped, and its platform is read from that record
     * rather than taken from the caller.
     */
    const listed = await listZernioCampaigns(profileId)
    if (!listed.ok) {
      return NextResponse.json(
        { error: 'Zernio did not answer, so this campaign was not changed. It is still running as it was. Try again in a moment.' },
        { status: 502 },
      )
    }

    const record = listed.campaigns
      .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
      .find((c) => c.platformCampaignId === campaignId)

    if (!record) {
      // Covers both a campaign that belongs to someone else and one Zernio has
      // not finished syncing an id for, without confirming which.
      return NextResponse.json(
        {
          error:
            'That campaign could not be matched to this brand in Zernio, so nothing was changed. If it is new it may still be syncing — try again shortly, or change it in the platform’s own Ads Manager.',
        },
        { status: 404 },
      )
    }

    const platform = resolvePlatform(record.platform, body.platform)
    if (!platform) {
      return NextResponse.json(
        { error: 'Zernio did not say which platform this campaign runs on, so it was not changed. Pause or resume it in the platform’s own Ads Manager.' },
        { status: 422 },
      )
    }

    const result = await setZernioCampaignStatus(campaignId, status, platform)
    return NextResponse.json({ success: true, result })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'api/zernio/ads POST',
          err,
          'This campaign was not changed and is still running as it was. Try again, or change it in the platform’s own Ads Manager.',
        ),
      },
      { status: 500 },
    )
  }
}

/** Zernio's own record wins; the caller's value is only a fallback. */
function resolvePlatform(fromRecord: unknown, fromBody: unknown): ZernioAdPlatform | null {
  if (isZernioAdPlatform(fromRecord)) return fromRecord
  if (isZernioAdPlatform(fromBody)) return fromBody
  return null
}
