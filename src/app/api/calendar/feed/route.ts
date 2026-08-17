import { createAdminClient } from '@/lib/supabase/admin'
import { resolveApiKey, toScopedMcpPrincipal, type ScopedGrantRow } from '@/lib/auth/api-key'
import {
  assertProjectCapability,
  listGrantedProjectIds,
  type McpPrincipal,
} from '@/lib/security/project-access'
import { createHmac, timingSafeEqual } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * iCal feed for scheduled posts — one brand per feed.
 *
 * Two things this route used to get wrong.
 *
 * First, it resolved a PROJECT-SCOPED key and then asked the database for every
 * brand belonging to that key's user. A key granted one brand returned all
 * fourteen. Scope now comes from the grants themselves, the same way MCP does
 * it, so a key can only ever produce a feed for a project it was actually given.
 *
 * Second, the credential travelled in the query string. Query strings land in
 * server logs, browser history and Referer headers — and the string in question
 * was a full `nrs_sk_` API key, which also drives the Director, drafts posts and
 * publishes through /api/mcp. A leaked calendar address was an account takeover.
 *
 * The obvious fix — demand an Authorization header — cannot be used, and this is
 * the whole reason the route is shaped the way it is. Google Calendar and Apple
 * Calendar subscribe by fetching a plain URL on a timer. They cannot send a
 * custom header. Requiring one does not secure the feed, it deletes the feature.
 *
 * So the URL still carries a secret, but not that secret. It carries a derived,
 * feed-only token that can do exactly one thing: read ninety days of one brand's
 * calendar. It cannot chat to the Director, draft, publish, or authenticate
 * anywhere else. Losing it costs a calendar, not the agency.
 *
 * The token is `nrs_cal_v1.<keyId>.<brandId>.<hmac>`, where the HMAC is taken
 * over that pair using the API key's own stored `key_hash` as the secret. Three
 * properties fall out of that, with no new table and no new secret to manage:
 *
 *   - It is unguessable. keyId and brandId are uuids and would otherwise be
 *     enumerable; the signature is what makes the address unguessable, exactly
 *     what /api/zernio/connect was missing.
 *   - It is revocable, immediately. The signature is verified against a live
 *     `api_keys` row, so revoking the key kills every feed minted from it, and
 *     revoking the brand's grant kills that brand's feed on its own.
 *   - It carries no authority of its own. A valid signature only proves the URL
 *     was issued for this key and brand; permission is still read from the live
 *     grant below, and still requires `direct:read`.
 *
 * Usage:
 *   GET /api/calendar/feed             + Authorization: Bearer nrs_sk_...
 *       → JSON, one subscribe URL per granted brand. The key is used here, over
 *         TLS, in a header, once — and never again.
 *   GET /api/calendar/feed?token=nrs_cal_v1....
 *       → the iCal feed for that one brand. This is the address you paste into
 *         Google Calendar or Apple Calendar.
 */

const FEED_TOKEN_PREFIX = 'nrs_cal_v1'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX_256 = /^[a-f0-9]{64}$/i

/** One sentence for missing, malformed, expired and revoked tokens alike, so
 *  the public URL cannot be used to test whether a brand or key exists. */
const NOT_VALID =
  'This calendar link is no longer valid. It may have been revoked, or the brand may no longer be shared with it. Ask NRS for a fresh calendar address.'

const NEEDS_KEY =
  'This calendar feed needs a link of its own. Calendar addresses no longer accept an API key in the address bar, because addresses end up in browser history and server logs. Ask NRS for your calendar address — it starts with token=nrs_cal_v1 — and paste that into Google Calendar or Apple Calendar instead.'

type AdminClient = ReturnType<typeof createAdminClient>

interface ApiKeyRow {
  id: string
  user_id: string
  key_hash: string
}

interface BrandRow {
  id: string
  name: string
  slug: string
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  // No feed token: this is the mint request, and it must present the real key
  // in a header. Nothing here reads a credential out of the query string.
  if (!token) {
    const bearer = bearerToken(request)
    if (!bearer) return text(NEEDS_KEY, 401)

    const feeds = await issueFeedUrls(request, bearer)
    if (!feeds) return text(NOT_VALID, 401)

    return Response.json({
      feeds,
      howTo:
        'Paste one of these addresses into Google Calendar (Other calendars → From URL) or Apple Calendar (File → New Calendar Subscription). One address per brand, so each brand gets its own colour. Each address only reads that brand’s calendar.',
    })
  }

  const access = await resolveFeedToken(token)
  if (!access) return text(NOT_VALID, 401)

  const supabase = createAdminClient()

  // Belt and braces: the grant already decided this, and the brand must still
  // belong to the person the key was issued to.
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, slug')
    .eq('id', access.brandId)
    .eq('user_id', access.userId)
    .maybeSingle<BrandRow>()

  if (!brand) return text(NOT_VALID, 401)

  // Scheduled posts for this ONE brand: last 90 days plus everything ahead.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  const { data: posts } = await supabase
    .from('scheduled_posts')
    .select('id, brand_id, platform, caption, hashtags, status, scheduled_at, created_at')
    .eq('brand_id', brand.id)
    .gte('scheduled_at', ninetyDaysAgo)
    .order('scheduled_at', { ascending: true })
    .limit(500)

  const ical = buildCalendar(brand, posts ?? [])

  return new Response(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${fileName(brand.name)}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

/* ------------------------------------------------------------------ minting */

/**
 * One subscribe URL per brand this key may actually read.
 *
 * The list comes from the key's live grants, never from the owner's brand list,
 * which is the bug this route was carrying: a key granted one brand used to
 * produce a feed covering all fourteen.
 */
async function issueFeedUrls(
  request: Request,
  rawKey: string,
): Promise<Array<{ brand: string; slug: string; url: string }> | null> {
  const principal = await resolveApiKey(rawKey)
  if (!principal) return null

  const readable = listGrantedProjectIds(principal).filter((projectId) =>
    hasReadAccess(principal, projectId),
  )
  if (readable.length === 0) return []

  const supabase = createAdminClient()

  const { data: key } = await supabase
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('id', principal.keyId)
    .is('revoked_at', null)
    .maybeSingle<ApiKeyRow>()

  if (!key) return null

  const { data: brands } = await supabase
    .from('brands')
    .select('id, name, slug')
    .in('id', readable)
    .eq('user_id', key.user_id)
    .order('name')

  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin

  return (brands ?? []).map((brand) => ({
    brand: brand.name,
    slug: brand.slug,
    url: `${base}/api/calendar/feed?token=${buildFeedToken(key.key_hash, key.id, brand.id)}`,
  }))
}

/* ------------------------------------------------------------------- tokens */

function feedSignature(keyHash: string, keyId: string, brandId: string): string {
  return createHmac('sha256', keyHash)
    .update(`${FEED_TOKEN_PREFIX}:${keyId}:${brandId}`)
    .digest('hex')
}

function buildFeedToken(keyHash: string, keyId: string, brandId: string): string {
  return `${FEED_TOKEN_PREFIX}.${keyId}.${brandId}.${feedSignature(keyHash, keyId, brandId)}`
}

function parseFeedToken(token: string): { keyId: string; brandId: string; signature: string } | null {
  const parts = token.split('.')
  if (parts.length !== 4) return null

  const [prefix, keyId, brandId, signature] = parts
  if (prefix !== FEED_TOKEN_PREFIX) return null
  if (!UUID.test(keyId) || !UUID.test(brandId)) return null
  if (!HEX_256.test(signature)) return null

  return { keyId, brandId, signature }
}

/**
 * Verify a feed token and confirm the brand is still readable by it.
 *
 * The signature is only half the check. It proves the address was issued by us
 * for this key and brand; it grants nothing. Permission is read fresh from the
 * live grant every request, so revoking a project takes effect on the next
 * refresh rather than whenever the token happens to expire.
 */
async function resolveFeedToken(token: string): Promise<{ brandId: string; userId: string } | null> {
  const parsed = parseFeedToken(token)
  if (!parsed) return null

  const supabase = createAdminClient()

  const { data: key, error } = await supabase
    .from('api_keys')
    .select('id, user_id, key_hash')
    .eq('id', parsed.keyId)
    .eq('token_kind', 'access')
    .is('revoked_at', null)
    .maybeSingle<ApiKeyRow>()

  if (error || !key) return null

  const expected = feedSignature(key.key_hash, parsed.keyId, parsed.brandId)
  if (!equalHex(expected, parsed.signature)) return null

  const principal = await principalForKey(supabase, key)
  if (!principal) return null
  if (!hasReadAccess(principal, parsed.brandId)) return null

  return { brandId: parsed.brandId, userId: key.user_id }
}

/** The same live-grant rules every MCP tool runs on, reused rather than restated. */
async function principalForKey(supabase: AdminClient, key: ApiKeyRow): Promise<McpPrincipal | null> {
  const { data: keyGrants } = await supabase
    .from('api_key_project_grants')
    .select('project_access_grant_id')
    .eq('api_key_id', key.id)

  if (!keyGrants?.length) return null

  const { data: grants } = await supabase
    .from('project_access_grants')
    .select('id, brand_id, channel, status, revoked_at, expires_at, capabilities')
    .in('id', keyGrants.map((grant) => grant.project_access_grant_id))

  if (!grants) return null

  return toScopedMcpPrincipal({ id: key.id, user_id: key.user_id }, grants as ScopedGrantRow[])
}

function hasReadAccess(principal: McpPrincipal, projectId: string): boolean {
  try {
    assertProjectCapability(principal, projectId, 'direct:read')
    return true
  } catch {
    return false
  }
}

function bearerToken(request: Request): string {
  const value = request.headers.get('authorization') ?? ''
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : ''
}

function equalHex(a: string, b: string): boolean {
  if (!HEX_256.test(a) || !HEX_256.test(b)) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}

/* --------------------------------------------------------------------- iCal */

interface PostRow {
  id: string
  platform: string | null
  caption: string | null
  hashtags: unknown
  status: string | null
  scheduled_at: string | null
}

function buildCalendar(brand: BrandRow, posts: PostRow[]): string {
  const calName = `${brand.name} Marketing`
  const dtStamp = formatICalDate(new Date())

  const events = posts.flatMap((post) => {
    const start = new Date(post.scheduled_at ?? '')
    // One unreadable date must not take the whole feed down with it.
    if (!Number.isFinite(start.getTime())) return []
    const end = new Date(start.getTime() + 30 * 60 * 1000)

    const platform = titleCase(post.platform ?? 'social')
    const statusIcon = post.status === 'published' ? '[LIVE]'
      : post.status === 'failed' ? '[FAILED]'
      : post.status === 'draft' ? '[DRAFT]'
      : ''

    const summary = `${statusIcon} [${platform}] ${brand.name}`.trim()
    const caption = (post.caption ?? '').slice(0, 500)
    const hashtags = Array.isArray(post.hashtags)
      ? post.hashtags.map((tag: unknown) => `#${String(tag)}`).join(' ')
      : ''

    const description = [
      caption,
      hashtags ? `\n${hashtags}` : '',
      `\nStatus: ${post.status ?? 'unknown'}`,
      `Platform: ${platform}`,
      `Brand: ${brand.name}`,
    ].join('\n')

    return [[
      'BEGIN:VEVENT',
      `UID:nrs-${post.id}@notrealsmart.com.au`,
      `DTSTART:${formatICalDate(start)}`,
      `DTEND:${formatICalDate(end)}`,
      `DTSTAMP:${dtStamp}`,
      `SUMMARY:${icalText(summary)}`,
      `DESCRIPTION:${icalText(description)}`,
      `STATUS:${post.status === 'published' ? 'CONFIRMED' : post.status === 'failed' ? 'CANCELLED' : 'TENTATIVE'}`,
      `CATEGORIES:${[brand.name, platform, 'Marketing'].map(icalText).join(',')}`,
      'END:VEVENT',
    ].join('\r\n')]
  })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NotRealSmart//NRS Agency//EN',
    `X-WR-CALNAME:${icalText(calName)}`,
    'X-WR-TIMEZONE:Australia/Brisbane',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

/**
 * RFC 5545 text escaping.
 *
 * Without this a comma or semicolon in a caption ends the property early and a
 * caption containing a line that reads END:VEVENT rewrites the calendar's
 * structure. The order matters: backslashes first, or the escapes escape
 * each other.
 */
function icalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

function formatICalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function fileName(brandName: string): string {
  return (brandName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'calendar') + '-Marketing'
}

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
