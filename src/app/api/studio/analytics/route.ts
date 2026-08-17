import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchPlatformMetrics } from '@/lib/analytics/platform-metrics'
import type { PlatformKey } from '@/lib/mixpost/ui-tokens'
import { PLATFORM_BRAND_COLOURS } from '@/lib/mixpost/ui-tokens'

export const dynamic = 'force-dynamic'

/**
 * GET /api/studio/analytics?brandId=xxx&platform=instagram&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Fetches platform analytics for a brand. Today the source is Mixpost; after
 * Phase 10 it will fan out to direct platform APIs without UI changes.
 *
 * Empty results are returned as a structured `PlatformMetrics` shell with
 * `empty: true` so the UI can render an empty state instead of erroring.
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
