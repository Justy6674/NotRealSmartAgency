import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostAccounts, fetchMixpostReports, friendlyProvider } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAccounts, fetchZernioAnalytics, fetchZernioPosts } from '@/lib/zernio/client'
import { ZernioError } from '@/lib/zernio/errors'
import { ownerFacingPlatformLabel, periodToDateRange } from '@/lib/studio/social-read-source'

export const dynamic = 'force-dynamic'

/**
 * Cross-channel headline figures for one business, over a chosen period.
 *
 * ── What changed, and why ──────────────────────────────────────────────
 * The period arrived as a free string and anything unrecognised silently
 * became seven days, so a screen asking for ninety could be answered with a
 * week and no part of the response said so. The period is now one of three and
 * the range that was actually used travels back with the figures.
 *
 * X is not part of this product, so it is filtered out of both branches rather
 * than being rendered as a channel with nothing in it.
 *
 * ── Two upstream answers that are not ordinary errors ──────────────────
 * The publisher's request budget is shared across every business on the team,
 * so a 429 has to become a wait rather than a retry, and a 402 means OUR
 * billing is suspended — every business stops at once, and the person reading
 * this screen can do nothing about it. It is flagged for the operator and
 * given a plain sentence for the owner, never "your figures failed".
 */

const VALID_PERIODS = new Set(['7_days', '30_days', '90_days'])

const BILLING_OWNER =
  'Results are paused across the whole site while we sort something out at our end. Nothing has been lost — the figures return on their own.'

const BILLING_OPERATOR =
  'Publisher billing is suspended for the whole team. Every business stops at once until it is settled — this is not a per-business fault.'

const BUSY =
  'The results service is busy right now. Nothing has been changed — this screen will try again shortly.'

const UNREACHABLE =
  'The service that keeps your results did not answer, so these figures could not be read. Nothing has been changed.'

const DEFAULT_BACKOFF_SECONDS = 60

/** X is out of scope for this product and never appears on this desk. */
const EXCLUDED_PLATFORMS = new Set(['x', 'twitter'])

function isExcluded(label: string): boolean {
  return EXCLUDED_PLATFORMS.has(label.toLowerCase())
}

/**
 * 402 and 429 carry consequences the rest of the failures do not.
 *
 * `Retry-After` is not available here: the shared helpers raise a typed error
 * carrying the status but not the response headers, so a 429 gets a
 * conservative minute rather than a header value invented to look precise.
 */
function faultResponse(err: unknown): NextResponse | null {
  const status = err instanceof ZernioError ? err.status : undefined

  if (status === 402) {
    console.error('[analytics] 402 PAYMENT_REQUIRED — team billing suspended, every tenant is stopped')
    return NextResponse.json(
      {
        configured: true,
        platforms: {},
        reachable: false,
        problem: BILLING_OWNER,
        operatorAlert: BILLING_OPERATOR,
        billingSuspended: true,
      },
      { status: 503 },
    )
  }

  if (status === 429) {
    const res = NextResponse.json(
      {
        configured: true,
        platforms: {},
        reachable: false,
        problem: BUSY,
        retryAfterSeconds: DEFAULT_BACKOFF_SECONDS,
        busy: true,
      },
      { status: 429 },
    )
    res.headers.set('Retry-After', String(DEFAULT_BACKOFF_SECONDS))
    return res
  }

  return null
}

function metricsFromBreakdown(row: {
  impressions?: number
  reach?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  clicks?: number
  views?: number
  postCount?: number
}): Record<string, number> {
  const metrics: Record<string, number> = {}
  if (typeof row.impressions === 'number') metrics.impressions = row.impressions
  if (typeof row.reach === 'number') metrics.reach = row.reach
  if (typeof row.likes === 'number') metrics.likes = row.likes
  if (typeof row.comments === 'number') metrics.comments = row.comments
  if (typeof row.shares === 'number') metrics.shares = row.shares
  if (typeof row.saves === 'number') metrics.saves = row.saves
  if (typeof row.clicks === 'number') metrics.clicks = row.clicks
  if (typeof row.views === 'number') metrics.views = row.views
  if (typeof row.postCount === 'number') metrics.posts = row.postCount
  return metrics
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const requested = searchParams.get('period') ?? '7_days'
  const period = VALID_PERIODS.has(requested) ? requested : '7_days'

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  const access = await zernioProfileForBrand(supabase, user.id, brandId)
  if (access.access === 'denied') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 })
  }

  const { fromDate, toDate } = periodToDateRange(period)

  if (access.brand.profileId) {
    if (!process.env.ZERNIO_API_KEY) {
      return NextResponse.json({
        configured: true,
        linked: true,
        period,
        fromDate,
        toDate,
        platforms: {},
        accounts: [],
        reachable: false,
        problem: 'Results are not set up on this site yet, so nothing could be read.',
      })
    }

    try {
      const accounts = (await fetchZernioAccounts(access.brand.profileId)).filter(
        (account) => !isExcluded(account.platform),
      )

      // No accounts is a true answer, not a failure — twelve of fourteen
      // businesses are in exactly this state, and the screen must say so
      // rather than drawing an axis with nothing under it.
      if (accounts.length === 0) {
        return NextResponse.json({
          configured: true,
          linked: true,
          period,
          fromDate,
          toDate,
          platforms: {},
          accounts: [],
          reachable: true,
          problem: null,
        })
      }

      const analytics = await fetchZernioAnalytics({
        profileId: access.brand.profileId,
        fromDate,
        toDate,
      })

      if (analytics === null) {
        return NextResponse.json({
          configured: true,
          linked: true,
          period,
          fromDate,
          toDate,
          platforms: {},
          accounts: accounts.map((account) => ({
            id: account.id,
            platform: account.platform.toLowerCase(),
            label: account.displayName || account.username || account.platform,
          })),
          reachable: false,
          // Kept for the older card that reads `error`; the sentence a person
          // sees is `problem`.
          error: 'Analytics not available',
          problem: UNREACHABLE,
        })
      }

      const platforms: Record<string, { metrics: Record<string, number> }> = {}
      const allowedPlatforms = new Set(accounts.map((account) => account.platform.toLowerCase()))

      for (const row of analytics.platformBreakdown) {
        if (!allowedPlatforms.has(row.platform.toLowerCase())) continue
        const label = ownerFacingPlatformLabel(row.platform)
        if (isExcluded(label)) continue
        platforms[label] = { metrics: metricsFromBreakdown(row) }
      }

      if (Object.keys(platforms).length === 0) {
        for (const account of accounts) {
          const label = ownerFacingPlatformLabel(account.platform)
          if (isExcluded(label)) continue
          if (!platforms[label]) platforms[label] = { metrics: {} }
        }
      }

      const livePosts = await fetchZernioPosts({
        profileId: access.brand.profileId,
        status: 'published',
        limit: 20,
      })

      return NextResponse.json({
        configured: true,
        linked: true,
        period,
        fromDate,
        toDate,
        platforms,
        accounts: accounts.map((account) => ({
          id: account.id,
          platform: account.platform.toLowerCase(),
          label: account.displayName || account.username || account.platform,
        })),
        reachable: true,
        problem: null,
        posts: livePosts
          .map((post) => ({
            id: post.id,
            caption: post.content,
            platforms: post.platforms.map(ownerFacingPlatformLabel).filter((p) => !isExcluded(p)),
            published_at: post.scheduledFor ?? post.createdAt ?? null,
          }))
          .filter((post) => post.platforms.length > 0),
      })
    } catch (err) {
      const fault = faultResponse(err)
      if (fault) return fault
      console.error('[analytics] social read failed', err)
      return NextResponse.json({
        configured: true,
        linked: true,
        period,
        fromDate,
        toDate,
        platforms: {},
        accounts: [],
        reachable: false,
        error: 'Analytics not available',
        problem: UNREACHABLE,
      })
    }
  }

  const accounts = await fetchMixpostAccounts()
  if (!accounts) {
    return NextResponse.json({ configured: false, linked: false, period, fromDate, toDate })
  }

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, slug, social_urls')
    .eq('user_id', user.id)

  if (!brands?.length) {
    return NextResponse.json({ configured: false, linked: false, period, fromDate, toDate })
  }

  const brandMap = mapAccountsToBrandsRaw(accounts, brands)
  const brandAccounts = (brandMap.get(brandId) ?? []).filter(
    (account) => !isExcluded(friendlyProvider(account.provider)),
  )

  if (brandAccounts.length === 0) {
    return NextResponse.json({
      configured: true,
      linked: false,
      period,
      fromDate,
      toDate,
      platforms: {},
      accounts: [],
      reachable: true,
      problem: null,
    })
  }

  const platforms: Record<string, { metrics: Record<string, unknown> }> = {}

  const reportResults = await Promise.allSettled(
    brandAccounts.map(async (account) => {
      const report = await fetchMixpostReports(account.id, period)
      return { account, report }
    })
  )

  let hasError = false

  for (const result of reportResults) {
    if (result.status === 'fulfilled' && result.value.report) {
      const { account, report } = result.value
      const platformName = friendlyProvider(account.provider)
      platforms[platformName] = {
        metrics: report.metrics ?? {},
      }
    } else if (result.status === 'rejected') {
      hasError = true
    }
  }

  if (Object.keys(platforms).length === 0 && hasError) {
    return NextResponse.json({
      configured: true,
      linked: false,
      period,
      fromDate,
      toDate,
      platforms: {},
      accounts: [],
      reachable: false,
      error: 'Analytics not available',
      problem: UNREACHABLE,
    })
  }

  return NextResponse.json({
    configured: true,
    linked: false,
    period,
    fromDate,
    toDate,
    platforms,
    accounts: brandAccounts.map((account) => ({
      id: String(account.id),
      platform: friendlyProvider(account.provider).toLowerCase(),
      label: account.name || account.username || friendlyProvider(account.provider),
    })),
    reachable: !hasError,
    problem: hasError
      ? 'Some channels could not be read this time. What is shown is real.'
      : null,
  })
}
