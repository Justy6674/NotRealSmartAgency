import { createAdminClient } from '@/lib/supabase/admin'
import { resolveApiKey } from '@/lib/auth/api-key'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * iCal feed for scheduled posts.
 * Subscribe in Google Calendar, Apple Calendar, or any calendar app.
 *
 * Usage:
 *   /api/calendar/feed?key=nrs_sk_...             → all brands
 *   /api/calendar/feed?key=nrs_sk_...&brand=slug   → single brand
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const apiKey = url.searchParams.get('key')
  const brandFilter = url.searchParams.get('brand')

  if (!apiKey) {
    return new Response('Missing key parameter', { status: 401 })
  }

  const auth = await resolveApiKey(apiKey)
  if (!auth) {
    return new Response('Invalid API key', { status: 401 })
  }

  const supabase = createAdminClient()

  // Fetch brands for this user
  let brandQuery = supabase
    .from('brands')
    .select('id, name, slug')
    .eq('user_id', auth.userId)

  if (brandFilter) {
    brandQuery = brandQuery.eq('slug', brandFilter)
  }

  const { data: brands } = await brandQuery
  if (!brands?.length) {
    return new Response('No brands found', { status: 404 })
  }

  const brandIds = brands.map(b => b.id)
  const brandMap = Object.fromEntries(brands.map(b => [b.id, b]))

  // Fetch scheduled posts (last 90 days + future)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from('scheduled_posts')
    .select('id, brand_id, platform, caption, hashtags, status, scheduled_at, created_at')
    .in('brand_id', brandIds)
    .gte('scheduled_at', ninetyDaysAgo)
    .order('scheduled_at', { ascending: true })
    .limit(500)

  // Build iCal
  const calName = brandFilter
    ? `${brands[0].name} Marketing`
    : 'NRS Agency Marketing'

  const events = (posts ?? []).map(post => {
    const brand = brandMap[post.brand_id]
    const brandName = brand?.name ?? 'Unknown'
    const platform = (post.platform ?? 'social').charAt(0).toUpperCase() + (post.platform ?? 'social').slice(1)
    const statusIcon = post.status === 'published' ? '[LIVE]'
      : post.status === 'failed' ? '[FAILED]'
      : post.status === 'draft' ? '[DRAFT]'
      : ''

    const summary = `${statusIcon} [${platform}] ${brandName}`.trim()
    const caption = (post.caption ?? '').slice(0, 500).replace(/\n/g, '\\n')
    const hashtags = Array.isArray(post.hashtags) ? post.hashtags.map((h: string) => `#${h}`).join(' ') : ''
    const description = `${caption}${hashtags ? '\\n\\n' + hashtags : ''}\\n\\nStatus: ${post.status}\\nPlatform: ${platform}\\nBrand: ${brandName}`

    const start = new Date(post.scheduled_at)
    const end = new Date(start.getTime() + 30 * 60 * 1000) // 30 min duration

    const dtStart = formatICalDate(start)
    const dtEnd = formatICalDate(end)
    const dtStamp = formatICalDate(new Date())

    return [
      'BEGIN:VEVENT',
      `UID:nrs-${post.id}@notrealsmart.com.au`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `DTSTAMP:${dtStamp}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `STATUS:${post.status === 'published' ? 'CONFIRMED' : post.status === 'failed' ? 'CANCELLED' : 'TENTATIVE'}`,
      `CATEGORIES:${brandName},${platform},Marketing`,
      'END:VEVENT',
    ].join('\r\n')
  })

  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//NotRealSmart//NRS Agency//EN`,
    `X-WR-CALNAME:${calName}`,
    'X-WR-TIMEZONE:Australia/Brisbane',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `REFRESH-INTERVAL;VALUE=DURATION:PT1H`,
    `X-PUBLISHED-TTL:PT1H`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${calName.replace(/\s/g, '-')}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
