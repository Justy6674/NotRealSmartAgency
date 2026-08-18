import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import {
  campaignBelongsToBrand,
  fetchZernioAccounts,
  findOwnedZernioCampaign,
  listOwnedZernioCampaigns,
  setZernioCampaignStatus,
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
 *
 * Third, and worst, both handlers used `listZernioCampaigns` — which returns
 * whatever Zernio said about the whole team — as their proof of ownership. The
 * comment above the POST claimed "the campaign has to appear in this brand's
 * own profile", but the list it searched was not this brand's own profile; the
 * profileId went upstream as a hint and came back honoured or not, unknowably.
 * So tenant A could POST their own brandId with tenant B's platformCampaignId,
 * pass the brand check honestly, match B's row in the unfiltered list, and pause
 * B's live advertising. Both handlers now go through
 * `listOwnedZernioCampaigns` / `findOwnedZernioCampaign`, which match every row
 * against accounts we scoped ourselves and drop anything unattributable.
 */

/** What the browser sees. `problem` is written for the owner, never upstream's words. */
interface AdsPayload {
  /** True when this brand is linked to a Zernio ad profile. */
  configured: boolean
  /** True when Zernio answered. Null when there was nothing to ask. */
  reachable: boolean | null
  problem: string | null
  campaigns: unknown[]
  /** Rows Zernio returned that could not be attributed to this brand. */
  withheld?: number
}

const UNREACHABLE =
  'Ads figures could not be read just now. Nothing has been changed. If a campaign should be running, check it in the platform’s Ads Manager.'

const NOT_SET_UP =
  'Ads are not set up for this site, so no campaign figures can be read for any brand.'

const UNATTRIBUTABLE =
  'Campaign figures came back that could not be confirmed as this brand’s, so none are shown and nothing has been changed. Check the campaigns in the platform’s own Ads Manager.'

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

    const result = await listOwnedZernioCampaigns(access.brand.profileId, accountId)
    if (!result.ok) {
      const payload: AdsPayload = {
        configured: true,
        reachable: false,
        problem: result.reason === 'not_configured' ? NOT_SET_UP : UNREACHABLE,
        campaigns: [],
      }
      return NextResponse.json(payload)
    }

    /*
     * Everything withheld and nothing left is not an empty ledger.
     *
     * The filter fails closed, so a change in Zernio's shape — an accountId
     * that stops being sent, a profile reference that arrives populated
     * differently — would empty the list. Saying "no campaigns running" about
     * that is the exact lie this page was rewritten to stop telling, so it is
     * reported as an unreadable answer instead.
     */
    if (result.campaigns.length === 0 && result.withheld > 0) {
      console.error(
        `[zernio/ads] withheld ${result.withheld} unattributable campaign row(s) for brand ${access.brand.brandId}`,
      )
      const payload: AdsPayload = {
        configured: true,
        reachable: false,
        problem: UNATTRIBUTABLE,
        campaigns: [],
        withheld: result.withheld,
      }
      return NextResponse.json(payload)
    }

    const payload: AdsPayload = {
      configured: true,
      reachable: true,
      problem: null,
      // The raw record, because the ledger reads budgets, metrics and review
      // state off it. Only the set of records has been narrowed.
      campaigns: result.campaigns.map((campaign) => campaign.raw),
      withheld: result.withheld,
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
     * Ownership is decided here, from our own records — never by the shape of
     * an upstream list.
     *
     * A campaign id in the body proves nothing. It is used only to search a set
     * that `findOwnedZernioCampaign` has already narrowed to the accounts we
     * resolved for this brand's profile, and every row that could not be
     * attributed to those accounts was dropped before the search began.
     *
     * The predicate is then re-run here on the matched record. That is not
     * belt-and-braces for its own sake: "it was in the list I was handed" is
     * precisely the reasoning that let another tenant's campaign through, so
     * this handler proves the claim itself rather than inheriting it, against
     * the profile id it read from our database two statements ago.
     */
    const found = await findOwnedZernioCampaign(profileId, campaignId)
    if (!found.ok) {
      if (found.reason === 'not_owned') {
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
      return NextResponse.json(
        { error: 'Zernio did not answer, so this campaign was not changed. It is still running as it was. Try again in a moment.' },
        { status: 502 },
      )
    }

    const { campaign, scope } = found
    if (scope.profileId !== profileId || !campaignBelongsToBrand(campaign, scope)) {
      console.error('[zernio/ads] refused a campaign change that failed the second ownership check')
      return NextResponse.json(
        {
          error:
            'That campaign could not be matched to this brand in Zernio, so nothing was changed. If it is new it may still be syncing — try again shortly, or change it in the platform’s own Ads Manager.',
        },
        { status: 404 },
      )
    }

    // The platform is read off the owned record only. `body.platform` is a
    // claim by the caller about which network's money to stop, and the caller
    // has already been shown to be capable of naming a campaign that is not
    // theirs, so it is not consulted at all.
    if (!campaign.platform) {
      return NextResponse.json(
        { error: 'Zernio did not say which platform this campaign runs on, so it was not changed. Pause or resume it in the platform’s own Ads Manager.' },
        { status: 422 },
      )
    }

    const result = await setZernioCampaignStatus(campaign, status, scope)
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

/*
 * `resolvePlatform` used to live here and fell back to `body.platform` when
 * Zernio's record did not name one. It is gone: the record is the only source
 * now, because the fallback let the caller choose which network a status change
 * was sent to for a campaign the caller did not have to own. The UI still sends
 * `platform`; the route reads it nowhere, which is the intended contract.
 */
