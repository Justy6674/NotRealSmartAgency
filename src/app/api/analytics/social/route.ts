import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostAccounts, fetchMixpostReports, friendlyProvider } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAccounts, fetchZernioAnalytics, fetchZernioPosts } from '@/lib/zernio/client'
import { ownerFacingPlatformLabel, periodToDateRange } from '@/lib/studio/social-read-source'

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
  const period = searchParams.get('period') ?? '7_days'

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  const access = await zernioProfileForBrand(supabase, user.id, brandId)
  if (access.access === 'denied') {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 403 })
  }

  if (access.brand.profileId) {
    if (!process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ configured: true, platforms: {} })
    }

    const accounts = await fetchZernioAccounts(access.brand.profileId)
    if (accounts.length === 0) {
      return NextResponse.json({ configured: true, platforms: {} })
    }

    const { fromDate, toDate } = periodToDateRange(period)
    const analytics = await fetchZernioAnalytics({
      profileId: access.brand.profileId,
      fromDate,
      toDate,
    })

    if (analytics === null) {
      return NextResponse.json({
        configured: true,
        error: 'Analytics not available',
      })
    }

    const platforms: Record<string, { metrics: Record<string, number> }> = {}
    const allowedPlatforms = new Set(accounts.map((account) => account.platform.toLowerCase()))

    for (const row of analytics.platformBreakdown) {
      if (!allowedPlatforms.has(row.platform.toLowerCase())) continue
      const label = ownerFacingPlatformLabel(row.platform)
      platforms[label] = { metrics: metricsFromBreakdown(row) }
    }

    if (Object.keys(platforms).length === 0) {
      for (const account of accounts) {
        const label = ownerFacingPlatformLabel(account.platform)
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
      platforms,
      posts: livePosts.map((post) => ({
        id: post.id,
        caption: post.content,
        platforms: post.platforms.map(ownerFacingPlatformLabel),
        published_at: post.scheduledFor ?? post.createdAt ?? null,
      })),
    })
  }

  const accounts = await fetchMixpostAccounts()
  if (!accounts) {
    return NextResponse.json({ configured: false })
  }

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, slug, social_urls')
    .eq('user_id', user.id)

  if (!brands?.length) {
    return NextResponse.json({ configured: false })
  }

  const brandMap = mapAccountsToBrandsRaw(accounts, brands)
  const brandAccounts = brandMap.get(brandId)

  if (!brandAccounts?.length) {
    return NextResponse.json({ configured: true, platforms: {} })
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
      error: 'Analytics not available',
    })
  }

  return NextResponse.json({ configured: true, platforms })
}
