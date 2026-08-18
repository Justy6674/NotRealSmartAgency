import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { fetchZernioAccounts, fetchZernioAnalytics, getZernioClient } from '@/lib/zernio/client'
import { fetchZernioAccountsHealth, fetchZernioFollowerStats } from '@/lib/zernio/accounts'
import { ZernioError, unwrapZernio } from '@/lib/zernio/errors'
import { zernioIdOf } from '@/lib/zernio/types'
import {
  fetchZernioAnalyticsReport,
  fetchZernioBestTimeToPost,
  fetchZernioContentDecay,
  fetchZernioPostTimeline,
  fetchZernioPostingFrequency,
  fetchZernioResponseTime,
  syncZernioExternalPosts,
} from '@/lib/zernio/insights'

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
 * and `metrics`. `fetchZernioAnalytics` returns null both when the publisher
 * does not answer and when there is no key on this deployment, and a null read
 * is not the same thing as a quiet week.
 *
 * ── The views ──────────────────────────────────────────────────────────
 * One route, several questions, because they all share the same three
 * expensive preliminaries: who is asking, which brand, and which accounts that
 * brand is actually allowed to see.
 *
 *   (default)      daily metrics, unchanged
 *   intelligence   when to post, decay, frequency, followers, reply speed
 *   accounts       the analytics-capable accounts behind the selector row
 *   sync           how current the figures are, and whether they are still landing
 *   post           one post's own curve over time
 *   native         the platform's own insight numbers for one account
 *
 * POST pulls a post published outside this app into the store.
 */

const NOT_SIGNED_IN =
  'You are not signed in, so no figures could be read. Sign in and try again.'

const NOT_YOURS =
  'That brand could not be opened under this sign-in, so no figures were read.'

const NOT_SET_UP =
  'Posting and results are not set up on this site yet, so no figures can be read for any brand.'

const UNREACHABLE =
  'The service that keeps your results did not answer, so the figures below could not be read. Nothing has been changed. Try again in a moment.'

const NO_ACCOUNTS =
  'No accounts are connected to this business yet, so there is nothing to measure.'

/**
 * A billing lapse on OUR side stops every business at once.
 *
 * It is not a fault of the person reading the screen and there is nothing they
 * can do about it, so they get a plain sentence and the detail goes to the
 * operator field, which the desk shows only to us. Telling a subscriber "the
 * payment failed" about somebody else's account would be both wrong and alarming.
 */
const BILLING_OWNER =
  'Results are paused across the whole site while we sort something out at our end. Nothing has been lost — the figures return on their own.'

const BILLING_OPERATOR =
  'Publisher billing is suspended for the whole team. Every business stops at once until it is settled — this is not a per-business fault.'

const BUSY =
  'The results service is busy right now. Nothing has been changed — this screen will try again shortly.'

/** X is out of scope for this product and never appears on this desk. */
const EXCLUDED_PLATFORMS = new Set(['twitter', 'x'])

/** What the browser sees. `problem` is written for the owner, never upstream's words. */
interface AnalyticsPayload {
  /** True when this brand is linked to a publisher profile. */
  configured: boolean
  /** True when the publisher answered. Null when there was nothing to ask. */
  reachable: boolean | null
  problem: string | null
  metrics: unknown
}

/* ── Shared fate: 402 and 429 are not ordinary failures ─────────────────── */

/**
 * The rate budget is 60–1,200 requests a minute and it is shared across every
 * tenant on the team, so one busy screen can starve everybody. Two upstream
 * answers therefore have to be told apart from an ordinary error:
 *
 *  · 429 — we are over the shared budget. The caller must back off rather than
 *    retry immediately, so the wait travels back with the refusal.
 *  · 402 — OUR team billing is suspended, which stops every tenant at once.
 *    It is an operator problem, never the subscriber's, and it must never be
 *    reported to them as "your figures could not be read".
 *
 * `Retry-After` can only be read where this route makes the call itself and
 * still holds the Response; the shared library helpers throw a `ZernioError`
 * carrying the status but not the headers, so a 429 raised inside one of those
 * falls back to a conservative minute. That is stated rather than pretended.
 */
const DEFAULT_BACKOFF_SECONDS = 60

interface PublisherFault {
  status: number
  body: Record<string, unknown>
}

function faultOf(err: unknown): PublisherFault | null {
  const status = err instanceof ZernioError ? err.status : undefined

  if (status === 402) {
    console.error('[zernio] 402 PAYMENT_REQUIRED — team billing suspended, every tenant is stopped')
    return {
      status: 503,
      body: {
        configured: true,
        reachable: false,
        problem: BILLING_OWNER,
        operatorAlert: BILLING_OPERATOR,
        billingSuspended: true,
      },
    }
  }

  if (status === 429) {
    return {
      status: 429,
      body: {
        configured: true,
        reachable: false,
        problem: BUSY,
        retryAfterSeconds: DEFAULT_BACKOFF_SECONDS,
        busy: true,
      },
    }
  }

  return null
}

/** Turn a fault into a response, with the wait in the header a browser obeys. */
function faultResponse(fault: PublisherFault): NextResponse {
  const res = NextResponse.json(fault.body, { status: fault.status })
  const wait = fault.body.retryAfterSeconds
  if (typeof wait === 'number') res.headers.set('Retry-After', String(wait))
  return res
}

/* ── Access ────────────────────────────────────────────────────────────── */

type Resolved =
  | { ok: false; response: NextResponse }
  | { ok: true; profileId: string | null }

async function resolveBrand(request: Request): Promise<Resolved> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 }) }
  }

  const brandId = new URL(request.url).searchParams.get('brandId')
  if (!brandId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Choose a business first — figures are kept per business.' },
        { status: 400 },
      ),
    }
  }

  const access = await zernioProfileForBrand(supabase, user.id, brandId)
  if (access.access === 'denied') {
    return { ok: false, response: NextResponse.json({ error: NOT_YOURS }, { status: 403 }) }
  }

  return { ok: true, profileId: access.brand.profileId }
}

/**
 * Every account id this brand may be shown, and nothing else.
 *
 * `fetchZernioAccounts` returns `[]` on any failure, so an empty set means
 * "show nothing" rather than "show everything" — a blank panel is recoverable,
 * another customer's numbers are not.
 */
async function allowedAccountIds(profileId: string): Promise<Set<string>> {
  const own = await fetchZernioAccounts(profileId)
  return new Set(own.map((account) => account.id).filter((id) => id !== ''))
}

/* ── Entry ─────────────────────────────────────────────────────────────── */

export async function GET(request: Request) {
  try {
    const resolved = await resolveBrand(request)
    if (!resolved.ok) return resolved.response

    const { searchParams } = new URL(request.url)
    const view = searchParams.get('view')
    const platform = searchParams.get('platform') ?? undefined
    const fromDate = searchParams.get('fromDate') ?? searchParams.get('from') ?? undefined
    const toDate = searchParams.get('toDate') ?? searchParams.get('to') ?? undefined

    if (resolved.profileId === null) {
      // Linked to nothing. A real answer about a brand this person owns, and
      // the one most brands give: only two of fourteen are linked today.
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

    const profileId = resolved.profileId

    if (view === 'intelligence') {
      return NextResponse.json(await readIntelligence(profileId, fromDate, toDate))
    }

    if (view === 'accounts') {
      return NextResponse.json(await readAccounts(profileId))
    }

    if (view === 'sync') {
      return NextResponse.json(await readSyncState(profileId, fromDate, toDate))
    }

    if (view === 'post') {
      const postId = searchParams.get('postId')
      if (!postId) {
        return NextResponse.json(
          { error: 'No post was named, so nothing was read.' },
          { status: 400 },
        )
      }
      return await readPost({ profileId, postId, fromDate, toDate })
    }

    if (view === 'native') {
      const accountId = searchParams.get('accountId')
      if (!accountId || !platform) {
        return NextResponse.json(
          { error: 'Choose an account first — these figures are kept per account.' },
          { status: 400 },
        )
      }
      return await readNativeInsights({ profileId, accountId, platform, fromDate, toDate })
    }

    const metrics = await fetchZernioAnalytics({
      profileId,
      ...(platform ? { platform } : {}),
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
    })

    const payload: AnalyticsPayload = {
      configured: true,
      reachable: metrics !== null,
      problem: metrics === null ? UNREACHABLE : null,
      metrics,
    }
    return NextResponse.json(payload)
  } catch (err) {
    const fault = faultOf(err)
    if (fault) return faultResponse(fault)
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

/**
 * Bring in a post that was published somewhere else.
 *
 * `syncZernioExternalPosts` has existed for a while with no caller at all,
 * which meant a business whose history was posted by hand had an empty results
 * screen and no way to fix it. This is that way.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      brandId?: unknown
      accountId?: unknown
      url?: unknown
      postId?: unknown
    }

    const brandId = typeof body.brandId === 'string' ? body.brandId : null
    const accountId = typeof body.accountId === 'string' ? body.accountId : null

    if (!brandId) {
      return NextResponse.json(
        { error: 'Choose a business first — figures are kept per business.' },
        { status: 400 },
      )
    }
    if (!accountId) {
      return NextResponse.json(
        { error: 'Choose which account the post is on, so it lands in the right place.' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied' || access.brand.profileId === null) {
      return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
    }
    if (!process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ error: NOT_SET_UP }, { status: 503 })
    }

    const profileId = access.brand.profileId

    // Checked here as well as inside the helper. The account id arrived from a
    // browser, and an id from another customer's account would otherwise
    // attach their post to this desk.
    const allowed = await allowedAccountIds(profileId)
    if (!allowed.has(accountId)) {
      return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
    }

    const synced = await syncZernioExternalPosts({
      accountId,
      profileId,
      ...(typeof body.url === 'string' && body.url ? { url: body.url } : {}),
      ...(typeof body.postId === 'string' && body.postId ? { postId: body.postId } : {}),
    })

    return NextResponse.json({
      synced,
      problem: synced
        ? null
        : 'That post could not be brought in. Check the link is public and try again.',
    })
  } catch (err) {
    const fault = faultOf(err)
    if (fault) return faultResponse(fault)
    return NextResponse.json(
      {
        error: userSafeError(
          'api/zernio/analytics POST',
          err,
          'That post could not be brought in just now. Nothing has been changed.',
        ),
      },
      { status: 500 },
    )
  }
}

/* ── The intelligence view ─────────────────────────────────────────────── */

export interface IntelligencePayload {
  configured: true
  problem: string | null
  bestTime: { dayOfWeek: number; hourUtc: number; engagement: number; postCount: number }[]
  decay: { order: number; label: string; averagePctOfFinal: number; postCount: number }[]
  frequency: {
    platform: string
    postsPerWeek: number
    averageEngagementRate: number
    averageEngagement: number
    weeksCounted: number
  }[]
  followers: { accountLabel: string; points: { date: string; followers: number }[] }[]
  /** How fast replies go out. Null when the period holds no answered messages. */
  responseTime: { sampleSize: number; medianSeconds: number; p90Seconds: number } | null
}

/** ISO date `days` ago, for the calls that will not accept an open range. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

async function readIntelligence(
  profileId: string,
  fromDate: string | undefined,
  toDate: string | undefined,
): Promise<IntelligencePayload> {
  const from = fromDate ?? daysAgo(90)

  // Five independent reads. One being unavailable must not blank the four that
  // answered — a page that fails whole is a page nobody comes back to.
  const [slots, decay, frequency, followerStats, accounts, response] = await Promise.allSettled([
    fetchZernioBestTimeToPost({ profileId }),
    fetchZernioContentDecay({ profileId }),
    fetchZernioPostingFrequency({ profileId }),
    fetchZernioFollowerStats({ profileId, fromDate: from, ...(toDate ? { toDate } : {}) }),
    fetchZernioAccounts(profileId),
    // `fromDate` is required upstream on every inbox-analytics call; omitting
    // it is a 400, not a default range.
    fetchZernioResponseTime({ fromDate: from, ...(toDate ? { toDate } : {}), profileId }),
  ])

  const failures = [slots, decay, frequency, followerStats, response].filter(
    (result) => result.status === 'rejected',
  ).length

  const accountNames = new Map<string, string>()
  if (accounts.status === 'fulfilled') {
    for (const account of accounts.value) {
      accountNames.set(
        account.id,
        account.displayName || account.username || account.platform || 'One of your accounts',
      )
    }
  }

  const followers = followerStats.status === 'fulfilled'
    ? Object.entries(followerStats.value).map(([accountId, points]) => ({
        accountLabel: accountNames.get(accountId) ?? 'One of your accounts',
        points,
      }))
    : []

  const timing = response.status === 'fulfilled' && response.value.sampleSize > 0
    ? {
        sampleSize: response.value.sampleSize,
        medianSeconds: response.value.medianSeconds,
        p90Seconds: response.value.p90Seconds,
      }
    : null

  return {
    configured: true,
    problem: failures > 0
      ? 'Some of these could not be worked out just now. What is shown is real; anything missing will fill in on the next look.'
      : null,
    bestTime: slots.status === 'fulfilled'
      ? slots.value.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          hourUtc: slot.hourUtc,
          engagement: slot.averageEngagement,
          postCount: slot.postCount,
        }))
      : [],
    decay: decay.status === 'fulfilled'
      ? decay.value.map((bucket) => ({
          order: bucket.order,
          label: bucket.label,
          averagePctOfFinal: bucket.averagePctOfFinal,
          postCount: bucket.postCount,
        }))
      : [],
    frequency: frequency.status === 'fulfilled'
      ? frequency.value.map((row) => ({
          platform: row.platform,
          postsPerWeek: row.postsPerWeek,
          averageEngagementRate: row.averageEngagementRate,
          averageEngagement: row.averageEngagement,
          weeksCounted: row.weeksCounted,
        }))
      : [],
    followers,
    responseTime: timing,
  }
}

/* ── The accounts view: what the selector row is made of ────────────────── */

export interface AnalyticsAccount {
  id: string
  platform: string
  label: string
  username?: string
  image?: string
  followers?: number
  /**
   * Whether this connection can report figures at all.
   *
   * `null` means nobody could tell us — the health lookup did not answer. That
   * is deliberately not `false`: hiding an account because a side lookup failed
   * would empty the row and look like the accounts had gone.
   */
  canFetchAnalytics: boolean | null
  health: 'healthy' | 'warning' | 'error' | 'unknown'
}

export interface AnalyticsAccountsPayload {
  configured: true
  accounts: AnalyticsAccount[]
  problem: string | null
}

/** Avatars and follower counts. A failure here costs a picture, never the row. */
async function decorations(
  profileId: string,
): Promise<Map<string, { image?: string; followers?: number }>> {
  const out = new Map<string, { image?: string; followers?: number }>()
  try {
    const zernio = getZernioClient('accounts.listAccounts (analytics decoration)')
    const result = await zernio.accounts.listAccounts({ query: { profileId } })
    const body = (result as { data?: unknown }).data as Record<string, unknown> | undefined
    const rows = Array.isArray(body?.accounts) ? body.accounts : []
    for (const row of rows) {
      const rec = (row ?? {}) as Record<string, unknown>
      const id = zernioIdOf(rec)
      if (!id) continue
      out.set(id, {
        ...(typeof rec.profilePicture === 'string' && rec.profilePicture
          ? { image: rec.profilePicture }
          : {}),
        ...(typeof rec.followersCount === 'number' ? { followers: rec.followersCount } : {}),
      })
    }
  } catch (err) {
    console.error('[api/zernio/analytics] account decoration failed', err)
  }
  return out
}

async function readAccounts(profileId: string): Promise<AnalyticsAccountsPayload> {
  const scoped = await fetchZernioAccounts(profileId)

  const [healthResult, decorated] = await Promise.allSettled([
    fetchZernioAccountsHealth(profileId),
    decorations(profileId),
  ])

  const health = healthResult.status === 'fulfilled' ? healthResult.value : null
  if (healthResult.status === 'rejected') {
    console.error('[api/zernio/analytics] health lookup failed', healthResult.reason)
  }
  const byId = new Map((health?.accounts ?? []).map((entry) => [entry.accountId, entry]))
  const extras = decorated.status === 'fulfilled'
    ? decorated.value
    : new Map<string, { image?: string; followers?: number }>()

  const accounts: AnalyticsAccount[] = scoped
    .filter((account) => !EXCLUDED_PLATFORMS.has(account.platform.toLowerCase()))
    .map((account) => {
      const entry = byId.get(account.id)
      const extra = extras.get(account.id)
      return {
        id: account.id,
        platform: account.platform.toLowerCase(),
        label: account.displayName || account.username || account.platform || 'Account',
        ...(account.username ? { username: account.username } : {}),
        ...(extra?.image ? { image: extra.image } : {}),
        ...(typeof extra?.followers === 'number' ? { followers: extra.followers } : {}),
        canFetchAnalytics: entry ? entry.canFetchAnalytics : null,
        health: entry?.status ?? ('unknown' as const),
      }
    })

  return {
    configured: true,
    accounts,
    problem: accounts.length === 0
      ? NO_ACCOUNTS
      : health === null
        ? 'We could not check which of these are reporting figures at the moment, so all of them are shown.'
        : null,
  }
}

/* ── The sync view: how current the figures are ─────────────────────────── */

export interface AnalyticsSyncPayload {
  configured: true
  lastSync: string | null
  dataStaleness: string | null
  totalPosts: number | null
  publishedPosts: number | null
  scheduledPosts: number | null
  /**
   * True while there are published posts but nothing has landed yet — the
   * first collection after connecting an account, which takes a while and
   * otherwise looks exactly like a business that has never posted.
   */
  collecting: boolean
  problem: string | null
}

async function readSyncState(
  profileId: string,
  fromDate: string | undefined,
  toDate: string | undefined,
): Promise<AnalyticsSyncPayload> {
  try {
    const report = await fetchZernioAnalyticsReport({
      profileId,
      ...(fromDate ? { fromDate } : {}),
      ...(toDate ? { toDate } : {}),
      source: 'all',
      limit: 1,
    })

    const published = report.overview.publishedPosts ?? null
    return {
      configured: true,
      lastSync: report.overview.lastSync ?? null,
      dataStaleness: report.overview.dataStaleness ?? null,
      totalPosts: report.overview.totalPosts ?? null,
      publishedPosts: published,
      scheduledPosts: report.overview.scheduledPosts ?? null,
      collecting: !report.overview.lastSync && (published ?? 0) > 0,
      problem: report.hasAnalyticsAccess
        ? null
        : 'None of the connected accounts is reporting figures yet. Reconnect one under Accounts if this does not settle.',
    }
  } catch (err) {
    // A busy budget or a suspended account are not "we could not read it" —
    // they have their own answers, and the caller has to be able to tell them
    // apart to back off or to raise the alarm. Everything else degrades here.
    if (err instanceof ZernioError && (err.status === 402 || err.status === 429)) throw err
    console.error('[api/zernio/analytics] sync state failed', err)
    return {
      configured: true,
      lastSync: null,
      dataStaleness: null,
      totalPosts: null,
      publishedPosts: null,
      scheduledPosts: null,
      collecting: false,
      problem: UNREACHABLE,
    }
  }
}

/* ── The post view: one post's own curve ────────────────────────────────── */

export interface PostTimelinePayload {
  configured: true
  postId: string
  /** Metric names present across the whole curve, in a stable order. */
  metricKeys: string[]
  points: { at: string; metrics: Record<string, number> }[]
  totals: Record<string, number>
  publishedAt: string | null
  problem: string | null
}

/**
 * Every account id a post row can be attributed to.
 *
 * A post's own `profileId` is deliberately not read: that is the publisher
 * saying whose data this is, which is the claim being checked rather than
 * trusted. `zernioIdOf` throughout, because `platforms[].accountId` arrives as
 * a populated `{_id, name}` object often enough that comparing the raw field to
 * a string matches nothing, silently.
 */
function rowAccountIds(raw: unknown): string[] {
  const rec = (raw ?? {}) as Record<string, unknown>
  const ids: string[] = []
  const push = (value: unknown) => {
    const id = zernioIdOf(value)
    if (id) ids.push(id)
  }
  push(rec.accountId)
  push(rec.account)
  if (Array.isArray(rec.platforms)) {
    for (const entry of rec.platforms) {
      if (entry && typeof entry === 'object') {
        const platform = entry as Record<string, unknown>
        push(platform.accountId ?? platform.account)
      }
    }
  }
  return ids
}

async function readPost(params: {
  profileId: string
  postId: string
  fromDate?: string
  toDate?: string
}): Promise<NextResponse> {
  const allowed = await allowedAccountIds(params.profileId)
  if (allowed.size === 0) {
    return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
  }

  // The timeline endpoint accepts any post id, ours or an external one, and
  // checks nothing about who owns it — so the ownership check has to happen
  // before the read, not after. `getAnalytics({postId})` is the only resolver
  // that answers for external ids as well as ours.
  const zernio = getZernioClient('analytics.getAnalytics (post)')
  const result = await zernio.analytics.getAnalytics({
    query: { postId: params.postId, profileId: params.profileId },
  })
  const data = unwrapZernio<Record<string, unknown>>('analytics.getAnalytics (post)', result as never)
  const rows = Array.isArray(data.posts) ? data.posts : []
  const row = rows.find((entry) => rowAccountIds(entry).some((id) => allowed.has(id)))

  if (!row) {
    // Either the post belongs to somebody else or it could not be attributed
    // to anything. Both fail closed, and both give the same answer so that a
    // post id cannot be probed for existence.
    return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
  }

  const rec = row as Record<string, unknown>
  const publishedAt = typeof rec.publishedAt === 'string' ? rec.publishedAt : null

  const points = await fetchZernioPostTimeline({
    postId: params.postId,
    ...(params.fromDate ? { fromDate: params.fromDate } : {}),
    ...(params.toDate ? { toDate: params.toDate } : {}),
  })

  const keys: string[] = []
  const totals: Record<string, number> = {}
  for (const point of points) {
    for (const [key, value] of Object.entries(point.metrics)) {
      if (!keys.includes(key)) keys.push(key)
      totals[key] = Math.max(totals[key] ?? 0, value)
    }
  }

  const payload: PostTimelinePayload = {
    configured: true,
    postId: params.postId,
    metricKeys: keys,
    points,
    // A running curve is cumulative, so the last reading is the figure and the
    // sum of the readings would be a number that never happened.
    totals,
    publishedAt,
    problem: points.length === 0
      ? 'This post has no day-by-day figures yet. They usually appear within a day of publishing.'
      : null,
  }
  return NextResponse.json(payload)
}

/* ── The native view: the platform's own insight numbers ────────────────── */

export interface NativeMetric {
  key: string
  label: string
  total: number | null
  points: { date: string; value: number }[]
}

export interface NativeInsightsPayload {
  configured: true
  platform: string
  accountId: string
  metrics: NativeMetric[]
  /** Metrics the platform refused or had no data for. Never reported as zero. */
  unavailable: string[]
  problem: string | null
}

/**
 * Plain English for the metric names the platforms use.
 *
 * Anything not listed is prettified rather than dropped: a new metric appearing
 * with an ugly name is better than a new metric disappearing.
 */
const NATIVE_METRIC_LABELS: Record<string, string> = {
  reach: 'People reached',
  views: 'Views',
  accounts_engaged: 'Accounts engaged',
  total_interactions: 'Interactions',
  comments: 'Comments',
  likes: 'Likes',
  saves: 'Saves',
  shares: 'Shares',
  replies: 'Replies',
  reposts: 'Reposts',
  follows_and_unfollows: 'Follows and unfollows',
  profile_links_taps: 'Profile link taps',
  follower_count: 'Followers',
  followers_gained: 'New followers',
  followers_lost: 'Followers lost',
  page_media_view: 'Times shown',
  page_views_total: 'Page views',
  page_post_engagements: 'Post engagement',
  page_video_views: 'Video views',
  page_video_view_time: 'Video watch time',
  page_follows: 'Page followers',
  estimatedMinutesWatched: 'Minutes watched',
  averageViewDuration: 'Average view length',
  subscribersGained: 'New subscribers',
  subscribersLost: 'Subscribers lost',
  likes_count: 'Likes',
  video_count: 'Videos',
  following_count: 'Following',
  IMPRESSION: 'Times shown',
  MEMBERS_REACHED: 'People reached',
  REACTION: 'Reactions',
  COMMENT: 'Comments',
  RESHARE: 'Reshares',
  POST_SAVE: 'Saves',
  POST_SEND: 'Sends',
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'Seen on maps, desktop',
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'Seen in search, desktop',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'Seen on maps, mobile',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'Seen in search, mobile',
  BUSINESS_CONVERSATIONS: 'Conversations started',
  BUSINESS_DIRECTION_REQUESTS: 'Directions requested',
  CALL_CLICKS: 'Calls',
  WEBSITE_CLICKS: 'Website visits',
  BUSINESS_BOOKINGS: 'Bookings',
  BUSINESS_FOOD_ORDERS: 'Food orders',
  BUSINESS_FOOD_MENU_CLICKS: 'Menu views',
}

function prettyMetricName(key: string): string {
  const known = NATIVE_METRIC_LABELS[key]
  if (known) return known
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** The one response shape every platform-native insight call answers with. */
function normaliseNative(data: unknown): { metrics: NativeMetric[]; unavailable: string[] } {
  const rec = (data ?? {}) as Record<string, unknown>
  const raw = (rec.metrics ?? {}) as Record<string, unknown>
  const metrics: NativeMetric[] = []

  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue
    const entry = value as Record<string, unknown>
    const total = typeof entry.total === 'number' && Number.isFinite(entry.total)
      ? entry.total
      : null
    const values = Array.isArray(entry.values) ? entry.values : []
    const points = values.flatMap((point) => {
      const p = (point ?? {}) as Record<string, unknown>
      const date = typeof p.date === 'string' ? p.date : null
      const v = typeof p.value === 'number' && Number.isFinite(p.value) ? p.value : null
      return date !== null && v !== null ? [{ date, value: v }] : []
    })
    metrics.push({ key, label: prettyMetricName(key), total, points })
  }

  const unavailable = Array.isArray(rec.unavailableMetrics)
    ? rec.unavailableMetrics.filter((name): name is string => typeof name === 'string')
    : []

  return { metrics, unavailable }
}

/** Which platform names route to which insight call. */
function nativePlatformOf(raw: string): string {
  const lower = raw.toLowerCase().replace(/[^a-z]/g, '')
  if (lower.startsWith('facebook')) return 'facebook'
  if (lower.startsWith('instagram')) return 'instagram'
  if (lower.startsWith('youtube')) return 'youtube'
  if (lower.startsWith('linkedin')) return 'linkedin'
  if (lower.startsWith('tiktok')) return 'tiktok'
  if (lower.startsWith('google')) return 'googlebusiness'
  return lower
}

async function readNativeInsights(params: {
  profileId: string
  accountId: string
  platform: string
  fromDate?: string
  toDate?: string
}): Promise<NextResponse> {
  const allowed = await allowedAccountIds(params.profileId)
  if (!allowed.has(params.accountId)) {
    // The publisher validates an account id against the whole team, so this is
    // the only check standing between a guessed id and another customer's
    // audience figures.
    return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
  }

  const platform = nativePlatformOf(params.platform)
  const since = params.fromDate ?? daysAgo(30)
  const until = params.toDate ?? new Date().toISOString().slice(0, 10)
  const accountId = params.accountId

  try {
    const zernio = getZernioClient(`analytics.${platform} insights`)
    let data: unknown = null

    switch (platform) {
      case 'instagram': {
        // Two calls, because reach is the only Instagram metric that carries a
        // daily series and the follower count comes from a different endpoint
        // entirely. Settled, so one refusal does not blank the other.
        const [insights, followers] = await Promise.allSettled([
          zernio.analytics.getInstagramAccountInsights({
            query: { accountId, since, until, metricType: 'total_value' },
          }),
          zernio.analytics.getInstagramFollowerHistory({
            query: { accountId, since, until, metricType: 'time_series' },
          }),
        ])
        const merged = mergeNative([
          insights.status === 'fulfilled'
            ? unwrapZernio<Record<string, unknown>>('analytics.getInstagramAccountInsights', insights.value as never)
            : null,
          followers.status === 'fulfilled'
            ? unwrapZernio<Record<string, unknown>>('analytics.getInstagramFollowerHistory', followers.value as never)
            : null,
        ])
        return NextResponse.json(nativePayload(platform, accountId, merged))
      }
      case 'facebook': {
        const result = await zernio.analytics.getFacebookPageInsights({
          query: { accountId, since, until, metricType: 'time_series' },
        })
        data = unwrapZernio<Record<string, unknown>>('analytics.getFacebookPageInsights', result as never)
        break
      }
      case 'youtube': {
        const result = await zernio.analytics.getYouTubeChannelInsights({
          query: { accountId, since, until, metricType: 'time_series' },
        })
        data = unwrapZernio<Record<string, unknown>>('analytics.getYouTubeChannelInsights', result as never)
        break
      }
      case 'tiktok': {
        const result = await zernio.analytics.getTikTokAccountInsights({
          query: { accountId, since, until, metricType: 'time_series' },
        })
        data = unwrapZernio<Record<string, unknown>>('analytics.getTikTokAccountInsights', result as never)
        break
      }
      case 'linkedin': {
        // The only one of the six that takes the account in the path rather
        // than the query, and the only one whose dates are start/end.
        const result = await zernio.analytics.getLinkedInAggregateAnalytics({
          path: { accountId },
          query: { aggregation: 'DAILY', startDate: since, endDate: until },
        })
        data = unwrapZernio<Record<string, unknown>>('analytics.getLinkedInAggregateAnalytics', result as never)
        break
      }
      case 'googlebusiness': {
        const result = await zernio.analytics.getGoogleBusinessPerformance({
          query: { accountId, startDate: since, endDate: until },
        })
        data = unwrapZernio<Record<string, unknown>>('analytics.getGoogleBusinessPerformance', result as never)
        break
      }
      default: {
        const payload: NativeInsightsPayload = {
          configured: true,
          platform,
          accountId,
          metrics: [],
          unavailable: [],
          problem: 'This channel does not report its own extra figures.',
        }
        return NextResponse.json(payload)
      }
    }

    return NextResponse.json(nativePayload(platform, accountId, normaliseNative(data)))
  } catch (err) {
    const fault = faultOf(err)
    if (fault) return faultResponse(fault)
    console.error('[api/zernio/analytics] native insights failed', err)
    const payload: NativeInsightsPayload = {
      configured: true,
      platform,
      accountId,
      metrics: [],
      unavailable: [],
      problem: UNREACHABLE,
    }
    return NextResponse.json(payload)
  }
}

function mergeNative(
  parts: (Record<string, unknown> | null)[],
): { metrics: NativeMetric[]; unavailable: string[] } {
  const metrics: NativeMetric[] = []
  const unavailable: string[] = []
  for (const part of parts) {
    if (!part) continue
    const one = normaliseNative(part)
    for (const metric of one.metrics) {
      if (!metrics.some((existing) => existing.key === metric.key)) metrics.push(metric)
    }
    for (const name of one.unavailable) {
      if (!unavailable.includes(name)) unavailable.push(name)
    }
  }
  return { metrics, unavailable }
}

function nativePayload(
  platform: string,
  accountId: string,
  parsed: { metrics: NativeMetric[]; unavailable: string[] },
): NativeInsightsPayload {
  return {
    configured: true,
    platform,
    accountId,
    metrics: parsed.metrics,
    unavailable: parsed.unavailable,
    problem: parsed.metrics.length === 0
      ? 'This channel has not sent any of its own figures for this period yet.'
      : null,
  }
}
