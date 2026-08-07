/**
 * Monday morning: who visited the sites last week, emailed to the owners.
 *
 * NRS could answer "how many people visited Scent Sell" if asked, but nobody
 * is going to ask every week. A number nobody looks at is the same as no
 * number, so it comes to them.
 *
 * Each brand is fetched independently — one site with analytics switched off
 * must not cost the report the other ten.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import {
  dateWindow,
  getTrafficBy,
  getTrafficTotals,
  VercelAnalyticsError,
  vercelAnalyticsConfigured,
} from '@/lib/analytics/vercel-analytics'
import {
  buildWeeklyTrafficHtml,
  buildWeeklyTrafficText,
  type BrandTraffic,
} from '@/lib/analytics/weekly-report'

export const runtime = 'nodejs'
export const maxDuration = 300

/** Who gets it. Both owners, because both run the businesses. */
const RECIPIENTS = ['downscaleweightloss@gmail.com', 'bec@downscale.com.au']

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

interface BrandRow {
  id: string
  name: string
  website_url: string | null
  vercel_project: string | null
  vercel_team: string | null
}

async function gather(brand: BrandRow, now: Date): Promise<BrandTraffic> {
  const base: BrandTraffic = {
    brand: brand.name,
    website: brand.website_url,
    visitors: null,
    pageviews: null,
    previousVisitors: null,
  }

  if (!brand.vercel_project) {
    return { ...base, note: 'no website connected' }
  }

  const target = { project: brand.vercel_project, team: brand.vercel_team }
  const thisWeek = dateWindow(7, now)
  // The same seven days a week earlier, so the comparison is like for like.
  const lastWeek = {
    since: dateWindow(14, now).since,
    until: thisWeek.since,
  }

  try {
    const totals = await getTrafficTotals(target, thisWeek)

    // These three are extras. A failure in any of them must not cost the
    // headline number that was already fetched successfully.
    const [previous, referrers, pages] = await Promise.all([
      getTrafficTotals(target, lastWeek).catch(() => null),
      getTrafficBy(target, 'referrerHostname', { ...thisWeek, limit: 3 }).catch(() => []),
      getTrafficBy(target, 'route', { ...thisWeek, limit: 3 }).catch(() => []),
    ])

    return {
      ...base,
      visitors: totals.visitors,
      pageviews: totals.pageviews,
      previousVisitors: previous?.visitors ?? null,
      topReferrers: referrers,
      topPages: pages,
    }
  } catch (err) {
    return {
      ...base,
      note: err instanceof VercelAnalyticsError && err.message.includes('not switched on')
        ? 'analytics not switched on'
        : 'could not be read',
    }
  }
}

export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  if (!vercelAnalyticsConfigured()) {
    return NextResponse.json({ error: 'VERCEL_API_TOKEN is not set — no report was sent.' }, { status: 503 })
  }

  const admin = createAdminClient()
  const { data: brands } = await admin
    .from('brands')
    .select('id, name, website_url, vercel_project, vercel_team')
    .eq('is_active', true)
    .order('name')

  const now = new Date()
  const rows = await Promise.all(((brands ?? []) as BrandRow[]).map((brand) => gather(brand, now)))

  // Brands with no site at all are not news every Monday.
  const reportable = rows.filter((row) => row.visitors !== null || row.note !== 'no website connected')

  const weekEnding = now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  const text = buildWeeklyTrafficText(reportable, weekEnding)
  const html = buildWeeklyTrafficHtml(reportable, weekEnding)

  const measured = reportable.filter((row) => row.visitors !== null)
  const total = measured.reduce((sum, row) => sum + (row.visitors ?? 0), 0)

  // A preview run renders the exact email and sends nothing, so it can be read
  // before it ever reaches an inbox.
  const preview = new URL(request.url).searchParams.get('preview') === '1'
  if (preview) {
    return new NextResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not set — nothing was sent.', text }, { status: 503 })
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: `NotRealSmart <${process.env.RESEND_FROM_EMAIL ?? 'noreply@notrealsmart.com.au'}>`,
    to: RECIPIENTS,
    subject: `Website visitors — ${total.toLocaleString('en-AU')} last week`,
    html,
    text,
  })

  if (error) {
    console.error('[weekly-traffic] send failed:', error)
    return NextResponse.json({ error: 'The report was built but could not be sent.', detail: String(error) }, { status: 502 })
  }

  // Nothing is filed. The week-on-week comparison comes from the API itself,
  // which holds the history, so an archive here would be a second copy to keep
  // in step for no benefit.
  return NextResponse.json({ sent: true, recipients: RECIPIENTS.length, sites: measured.length, total_visitors: total })
}
