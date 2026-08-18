import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPlatformMetrics } from '@/lib/analytics/platform-metrics'
import type { PlatformKey } from '@/lib/mixpost/ui-tokens'
import { PLATFORM_BRAND_COLOURS } from '@/lib/mixpost/ui-tokens'

export const dynamic = 'force-dynamic'

/**
 * GET /api/studio/analytics
 *   ?brandId=…&platform=instagram&from=YYYY-MM-DD&to=YYYY-MM-DD[&accountId=…]
 *
 * One platform's results for one brand. `getMetricsSource()` decides where the
 * figures come from; this route never knows or names the source.
 *
 * `accountId` narrows the read to one of the brand's own accounts — the
 * selector row above the report sends it. It is passed through as a hint only:
 * the source resolves it against that brand's own scoped account list and
 * ignores anything that is not in it, so a borrowed id reads nothing.
 *
 * Three answers, never two. `empty` on its own means a genuinely quiet period;
 * `problem` means the read failed and is worth retrying; `notCollected` means
 * nobody is gathering results for this business at all. The screen prints a
 * different sentence for each, because acting on the wrong one is how a bad
 * fortnight goes unnoticed at a health brand.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const brandId = req.nextUrl.searchParams.get('brandId')
  const platformParam = req.nextUrl.searchParams.get('platform')
  const fromParam = req.nextUrl.searchParams.get('from')
  const toParam = req.nextUrl.searchParams.get('to')
  const accountIdParam = req.nextUrl.searchParams.get('accountId')

  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }
  if (!platformParam || !(platformParam in PLATFORM_BRAND_COLOURS)) {
    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  }

  // Verify the user actually owns the brand (RLS will also enforce this).
  const { data: brand, error: brandErr } = await supabase
    .from('brands')
    .select('id, social_urls')
    .eq('id', brandId)
    .maybeSingle()

  if (brandErr || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  // Default to a rolling 28-day window when not specified.
  const today = new Date()
  const defaultFrom = new Date(today)
  defaultFrom.setDate(defaultFrom.getDate() - 28)

  const from = fromParam ?? defaultFrom.toISOString().slice(0, 10)
  const to = toParam ?? today.toISOString().slice(0, 10)

  try {
    const metrics = await fetchPlatformMetrics({
      brandId,
      platform: platformParam as PlatformKey,
      from,
      to,
      socialUrls: brand.social_urls,
      ...(accountIdParam ? { accountId: accountIdParam } : {}),
    })
    return NextResponse.json(metrics)
  } catch (err) {
    console.error('[analytics] fetch failed', err)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
