/**
 * Performance: what the posts did, when to post next, and how fast we reply.
 *
 * Depended on by: the Analytics tab and its report components (S6), the
 * composer's "add to the next good time" (S3), and the studio overview.
 *
 * ── The fault this closes ──────────────────────────────────────────────
 * Ten report components in NRS can never render. Not "render empty" — never
 * render: all three sources in `platform-metrics.ts` return `timeseries: {}`
 * and `topPosts: []` as literals, and the shell then filters to "only those
 * that have data", which is always none. Forty lines of chart per report,
 * showing nothing, with no error anywhere. Everything needed to fill them was
 * live the whole time.
 *
 * ── Two fields the SDK's types do not declare ──────────────────────────
 * The live `daily-metrics` response carries a per-day
 * `platformMetrics: { instagram: { impressions, reach, … } }` that
 * `GetDailyMetricsResponse` omits, and `post-timeline` carries `follows` the
 * same way. Trust the SDK for the REQUEST; read the live response for fields.
 * Both are read defensively here and neither is required.
 *
 * Nothing in this file writes or publishes.
 */

import { fetchZernioAccounts, getZernioClient } from './client'
import { unwrapZernio } from './errors'
import { zernioIdOf } from './types'

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/* ── Whose numbers are these? Ours to decide, never Zernio's ───────────── */

/**
 * What a read is allowed to show.
 *
 * Every function below can be handed a `profileId`, and Zernio accepts it —
 * but `listAccounts({ profileId })` was measured on 2026-08-17 to accept that
 * same filter and ignore it, and Zernio's own multi-tenant guide validates ids
 * against the whole TEAM rather than a profile. So the argument narrows the
 * request and nothing else: this set decides what may be returned.
 *
 * `denied` is the state that matters. `fetchZernioAccounts` returns `[]` on ANY
 * failure — a rotated key, a 5xx, a timeout — so "no accounts" and "we could
 * not ask" are the same value here, and both must mean *show nothing*. A blank
 * chart is recoverable; a chart of another customer's numbers is not.
 */
type ZernioReadScope =
  | { kind: 'unscoped' }
  | { kind: 'denied' }
  | { kind: 'scoped'; allowed: Set<string> }

async function resolveReadScope(params: {
  profileId?: string
  accountId?: string
}): Promise<ZernioReadScope> {
  if (!params.profileId) return { kind: 'unscoped' }
  const own = await fetchZernioAccounts(params.profileId)
  const allowed = new Set(own.map((account) => account.id).filter((id) => id !== ''))
  if (allowed.size === 0) return { kind: 'denied' }
  // An account id the caller supplied is a claim, not a fact, until it is found
  // in this brand's own list.
  if (params.accountId && !allowed.has(params.accountId)) return { kind: 'denied' }
  return { kind: 'scoped', allowed }
}

/**
 * Every account id a row can be attributed to.
 *
 * `zernioIdOf` throughout: records carry `_id` rather than `id`, and
 * `platforms[].accountId` arrives as a populated `{_id, name}` object often
 * enough that comparing the raw field to a string matches nothing, silently.
 * A post's own `profileId` field is deliberately NOT read — that is Zernio
 * saying whose data this is, which is the thing being refused.
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
  if (Array.isArray(rec.accountIds)) rec.accountIds.forEach(push)
  if (Array.isArray(rec.accounts)) rec.accounts.forEach(push)
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

/**
 * Keep a row only when it names an account we own. Fails CLOSED: a row nothing
 * can be attributed to is dropped, never kept.
 */
function ownsRow(raw: unknown, allowed: Set<string>): boolean {
  return rowAccountIds(raw).some((id) => allowed.has(id))
}

/**
 * The three "when should we post" endpoints answer with STATISTICS — a slot, a
 * decay bucket, a frequency line — summed upstream across the profile before we
 * see them, so most rows name no account and there is nothing on them to
 * attribute. Two things therefore carry the isolation:
 *
 *  1. `resolveReadScope` at the top of the read, which returns nothing at all
 *     unless this brand resolves to accounts of its own; and
 *  2. this, for any row that DOES name an account — held to exactly the same
 *     fail-closed rule as a comment or a review.
 *
 * A summed figure whose inputs cannot be enumerated is the residual risk here,
 * and the honest way to remove it is to ask per account; that is what passing
 * `accountId` does, and why the scope above verifies it before the call.
 */
function dropRowsFromOtherAccounts(rows: unknown[], scope: ZernioReadScope): unknown[] {
  if (scope.kind !== 'scoped') return rows
  return rows.filter((row) => {
    const ids = rowAccountIds(row)
    if (ids.length === 0) return true
    return ids.some((id) => scope.allowed.has(id))
  })
}

function metricRecord(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = num(value)
    if (n !== undefined) out[key] = n
  }
  return out
}

/* ── Overview and posts ────────────────────────────────────────────────── */

export interface ZernioAnalyticsPost {
  id: string
  content: string
  publishedAt?: string
  platforms: string[]
  platformPostUrl?: string
  isExternal: boolean
  thumbnailUrl?: string
  mediaType?: string
  metrics: Record<string, number>
}

export interface ZernioAnalyticsOverview {
  /**
   * Counts are ABSENT rather than zero when the listing carried posts we could
   * not attribute to this brand. Upstream totals are computed over whatever
   * Zernio decided the profile covers, so once our own filter has removed a
   * row the totals describe somebody else's accounts too. "Not known" is a
   * true sentence; a number covering another customer's posting is not.
   */
  totalPosts?: number
  publishedPosts?: number
  scheduledPosts?: number
  lastSync?: string
  /** How old the numbers are. Say it on the page rather than implying "now". */
  dataStaleness?: string
}

export interface ZernioAnalytics {
  overview: ZernioAnalyticsOverview
  posts: ZernioAnalyticsPost[]
  hasAnalyticsAccess: boolean
}

export type ZernioAnalyticsSort =
  | 'date' | 'engagement' | 'impressions' | 'reach' | 'likes'
  | 'comments' | 'shares' | 'saves' | 'clicks' | 'views' | 'follows'

/**
 * The account's own numbers. Maximum range is 366 days upstream.
 *
 * `source: 'external'` is what reaches history published outside this app —
 * the same trap as `listPosts`, in a different endpoint.
 */
export async function fetchZernioAnalyticsReport(params: {
  profileId?: string
  accountId?: string
  platform?: string
  fromDate?: string
  toDate?: string
  sortBy?: ZernioAnalyticsSort
  source?: 'all' | 'late' | 'external'
  page?: number
  limit?: number
}): Promise<ZernioAnalytics> {
  const scope = await resolveReadScope(params)
  if (scope.kind === 'denied') {
    return { overview: {}, posts: [], hasAnalyticsAccess: false }
  }

  const zernio = getZernioClient('analytics.getAnalytics')
  const result = await zernio.analytics.getAnalytics({
    query: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
      ...(params.fromDate ? { fromDate: params.fromDate } : {}),
      ...(params.toDate ? { toDate: params.toDate } : {}),
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
      ...(params.source ? { source: params.source } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.limit ? { limit: params.limit } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('analytics.getAnalytics', result as never)
  const overviewRaw = (data.overview ?? {}) as Record<string, unknown>

  // Attribution runs on the RAW rows, before they are narrowed to the shape the
  // charts want: `platforms[].accountId` is the only field that says whose post
  // this is, and the mapping below throws it away.
  const rawPosts = Array.isArray(data.posts) ? data.posts : []
  const ownPosts = scope.kind === 'scoped'
    ? rawPosts.filter((row) => ownsRow(row, scope.allowed))
    : rawPosts
  const droppedPosts = rawPosts.length - ownPosts.length

  const posts = ownPosts.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const id = str(rec._id) ?? str(rec.id)
    if (!id) return []
    const platforms = Array.isArray(rec.platforms)
      ? rec.platforms.flatMap((p) => {
          if (typeof p === 'string') return [p]
          const platform = str((p as Record<string, unknown>)?.platform)
          return platform ? [platform] : []
        })
      : []
    return [{
      id,
      content: typeof rec.content === 'string' ? rec.content : '',
      ...(str(rec.publishedAt) ? { publishedAt: str(rec.publishedAt)! } : {}),
      platforms,
      ...(str(rec.platformPostUrl) ? { platformPostUrl: str(rec.platformPostUrl)! } : {}),
      isExternal: rec.isExternal === true,
      ...(str(rec.thumbnailUrl) ? { thumbnailUrl: str(rec.thumbnailUrl)! } : {}),
      ...(str(rec.mediaType) ? { mediaType: str(rec.mediaType)! } : {}),
      metrics: metricRecord(rec.analytics),
    }]
  })

  return {
    overview: {
      // Counts only while nothing had to be removed — see ZernioAnalyticsOverview.
      ...(droppedPosts === 0
        ? {
            totalPosts: num(overviewRaw.totalPosts) ?? 0,
            publishedPosts: num(overviewRaw.publishedPosts) ?? 0,
            scheduledPosts: num(overviewRaw.scheduledPosts) ?? 0,
          }
        : {}),
      ...(str(overviewRaw.lastSync) ? { lastSync: str(overviewRaw.lastSync)! } : {}),
      ...(str(overviewRaw.dataStaleness) ? { dataStaleness: str(overviewRaw.dataStaleness)! } : {}),
    },
    posts,
    hasAnalyticsAccess: data.hasAnalyticsAccess !== false,
  }
}

/* ── Daily metrics, including the undeclared per-platform block ────────── */

export interface ZernioDailyPoint {
  date: string
  postCount?: number
  metrics: Record<string, number>
  /**
   * Per-platform figures for that day. Live on the wire, absent from the SDK's
   * response type — read here because the alternative is charts that cannot
   * split by network.
   */
  platformMetrics: Record<string, Record<string, number>>
}

export async function fetchZernioDailyMetrics(params: {
  accountId: string
  platform?: string
  fromDate?: string
  toDate?: string
}): Promise<ZernioDailyPoint[]> {
  const zernio = getZernioClient('analytics.getDailyMetrics')
  const result = await zernio.analytics.getDailyMetrics({
    query: {
      accountId: params.accountId,
      ...(params.platform ? { platform: params.platform } : {}),
      ...(params.fromDate ? { fromDate: params.fromDate } : {}),
      ...(params.toDate ? { toDate: params.toDate } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('analytics.getDailyMetrics', result as never)
  const rows = Array.isArray(data.dailyData) ? data.dailyData : []

  return rows.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const date = str(rec.date)
    if (!date) return []
    const platformMetrics: Record<string, Record<string, number>> = {}
    const rawPlatform = rec.platformMetrics
    if (rawPlatform && typeof rawPlatform === 'object') {
      for (const [platform, metrics] of Object.entries(rawPlatform as Record<string, unknown>)) {
        platformMetrics[platform] = metricRecord(metrics)
      }
    }
    return [{
      date,
      ...(num(rec.postCount) !== undefined ? { postCount: num(rec.postCount)! } : {}),
      metrics: metricRecord(rec.metrics),
      platformMetrics,
    }]
  })
}

/* ── The three things Mixpost has no answer for ────────────────────────── */

export interface ZernioBestTimeSlot {
  /** 0 = Monday on this endpoint. Not the queue's 0 = Sunday. */
  dayOfWeek: number
  /** Hour in UTC. Convert before showing it to anybody. */
  hourUtc: number
  averageEngagement: number
  postCount: number
}

/**
 * When this brand's own audience actually engages.
 *
 * Note the two different week conventions in this codebase's upstream: this
 * endpoint counts 0 as Monday, while the posting queue counts 0 as Sunday.
 * Mixing them silently shifts every recommendation by a day.
 */
export async function fetchZernioBestTimeToPost(params: {
  profileId?: string
  accountId?: string
  platform?: string
  source?: 'all' | 'late' | 'external'
}): Promise<ZernioBestTimeSlot[]> {
  const scope = await resolveReadScope(params)
  if (scope.kind === 'denied') return []

  const zernio = getZernioClient('analytics.getBestTimeToPost')
  const result = await zernio.analytics.getBestTimeToPost({
    query: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
      ...(params.source ? { source: params.source } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('analytics.getBestTimeToPost', result as never)
  const slots = dropRowsFromOtherAccounts(Array.isArray(data.slots) ? data.slots : [], scope)
  return slots.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const dayOfWeek = num(rec.day_of_week) ?? num(rec.dayOfWeek)
    const hourUtc = num(rec.hour)
    if (dayOfWeek === undefined || hourUtc === undefined) return []
    return [{
      dayOfWeek,
      hourUtc,
      averageEngagement: num(rec.avg_engagement) ?? num(rec.averageEngagement) ?? 0,
      postCount: num(rec.post_count) ?? num(rec.postCount) ?? 0,
    }]
  })
}

export interface ZernioDecayBucket {
  order: number
  label: string
  averagePctOfFinal: number
  postCount: number
}

/** How quickly a post stops earning — `0-6h` through `7-30d`. */
export async function fetchZernioContentDecay(params: {
  profileId?: string
  accountId?: string
  platform?: string
}): Promise<ZernioDecayBucket[]> {
  const scope = await resolveReadScope(params)
  if (scope.kind === 'denied') return []

  const zernio = getZernioClient('analytics.getContentDecay')
  const result = await zernio.analytics.getContentDecay({
    query: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('analytics.getContentDecay', result as never)
  const buckets = dropRowsFromOtherAccounts(Array.isArray(data.buckets) ? data.buckets : [], scope)
  return buckets.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const label = str(rec.bucket_label) ?? str(rec.label)
    if (!label) return []
    return [{
      order: num(rec.bucket_order) ?? 0,
      label,
      averagePctOfFinal: num(rec.avg_pct_of_final) ?? 0,
      postCount: num(rec.post_count) ?? 0,
    }]
  })
}

export interface ZernioPostingFrequency {
  platform: string
  postsPerWeek: number
  averageEngagementRate: number
  averageEngagement: number
  weeksCounted: number
}

/** "How often should we post" answered from this brand's own history. */
export async function fetchZernioPostingFrequency(params: {
  profileId?: string
  accountId?: string
  platform?: string
}): Promise<ZernioPostingFrequency[]> {
  const scope = await resolveReadScope(params)
  if (scope.kind === 'denied') return []

  const zernio = getZernioClient('analytics.getPostingFrequency')
  const result = await zernio.analytics.getPostingFrequency({
    query: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('analytics.getPostingFrequency', result as never)
  const rows = dropRowsFromOtherAccounts(Array.isArray(data.frequency) ? data.frequency : [], scope)
  return rows.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const platform = str(rec.platform)
    if (!platform) return []
    return [{
      platform,
      postsPerWeek: num(rec.posts_per_week) ?? 0,
      averageEngagementRate: num(rec.avg_engagement_rate) ?? 0,
      averageEngagement: num(rec.avg_engagement) ?? 0,
      weeksCounted: num(rec.weeks_count) ?? 0,
    }]
  })
}

/**
 * How one post performed over time. Accepts EXTERNAL ids as well as ours.
 *
 * `follows` appears on the live response and not on the SDK's type, so the
 * points are kept as an open metric record rather than a fixed set of columns.
 */
export async function fetchZernioPostTimeline(params: {
  postId: string
  fromDate?: string
  toDate?: string
}): Promise<{ at: string; metrics: Record<string, number> }[]> {
  const zernio = getZernioClient('analytics.getPostTimeline')
  const result = await zernio.analytics.getPostTimeline({
    query: {
      postId: params.postId,
      ...(params.fromDate ? { fromDate: params.fromDate } : {}),
      ...(params.toDate ? { toDate: params.toDate } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('analytics.getPostTimeline', result as never)
  const rows = Array.isArray(data.timeline) ? data.timeline
    : Array.isArray(data.points) ? data.points
      : []
  return rows.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const at = str(rec.date) ?? str(rec.timestamp) ?? str(rec.at)
    if (!at) return []
    const metrics = rec.metrics && typeof rec.metrics === 'object'
      ? metricRecord(rec.metrics)
      : metricRecord(rec)
    return [{ at, metrics }]
  })
}

/**
 * Pull a post published outside this app into the analytics store.
 *
 * Scoped to the brand's own accounts first: syncing against an account this
 * brand does not own would attach another customer's post to this desk.
 */
export async function syncZernioExternalPosts(params: {
  accountId: string
  profileId?: string
  url?: string
  postId?: string
}): Promise<boolean> {
  if (params.profileId) {
    const own = await fetchZernioAccounts(params.profileId)
    if (!own.some((account) => account.id === params.accountId)) return false
  }
  const zernio = getZernioClient('analytics.syncExternalPosts')
  const result = await zernio.analytics.syncExternalPosts({
    body: {
      accountId: params.accountId,
      ...(params.url ? { url: params.url } : {}),
      ...(params.postId ? { postId: params.postId } : {}),
    },
  })
  return !result.error
}

/* ── Inbox analytics ───────────────────────────────────────────────────── */

export interface ZernioResponseTime {
  sampleSize: number
  medianSeconds: number
  p90Seconds: number
  p99Seconds: number
  meanSeconds: number
  histogram: { bucket: string; count: number }[]
}

/**
 * How fast we reply — the plain-English version of an SLA report.
 *
 * `fromDate` is REQUIRED upstream on every inbox-analytics call; omitting it is
 * a 400, not a default range.
 */
export async function fetchZernioResponseTime(params: {
  fromDate: string
  toDate?: string
  profileId?: string
  accountId?: string
  platform?: string
}): Promise<ZernioResponseTime> {
  const scope = await resolveReadScope(params)
  if (scope.kind === 'denied') {
    // Not an error, and not "we replied instantly": a zero sample says the
    // period holds nothing we may report, which is what the desk already
    // renders as no figure at all.
    return {
      sampleSize: 0,
      medianSeconds: 0,
      p90Seconds: 0,
      p99Seconds: 0,
      meanSeconds: 0,
      histogram: [],
    }
  }

  const zernio = getZernioClient('inboxanalytics.getInboxResponseTime')
  const result = await zernio.inboxanalytics.getInboxResponseTime({
    query: {
      fromDate: params.fromDate,
      ...(params.toDate ? { toDate: params.toDate } : {}),
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('inboxanalytics.getInboxResponseTime', result as never)
  const summary = (data.summary ?? {}) as Record<string, unknown>
  const histogram = dropRowsFromOtherAccounts(
    Array.isArray(data.histogram) ? data.histogram : [],
    scope,
  )

  return {
    sampleSize: num(summary.sampleSize) ?? 0,
    medianSeconds: num(summary.medianSeconds) ?? 0,
    p90Seconds: num(summary.p90Seconds) ?? 0,
    p99Seconds: num(summary.p99Seconds) ?? 0,
    meanSeconds: num(summary.meanSeconds) ?? 0,
    histogram: histogram.flatMap((entry) => {
      const rec = (entry ?? {}) as Record<string, unknown>
      const bucket = str(rec.bucket)
      return bucket ? [{ bucket, count: num(rec.count) ?? 0 }] : []
    }),
  }
}

/**
 * How many conversations came in, and from where.
 *
 * `source` separates human replies from workflow, sequence, broadcast, comment
 * automation and API traffic — which is how the desk can honestly say what the
 * Director answered versus what a person did.
 */
export async function fetchZernioInboxVolume(params: {
  fromDate: string
  toDate?: string
  profileId?: string
  accountId?: string
  platform?: string
  source?: string
}): Promise<Record<string, unknown>> {
  const scope = await resolveReadScope(params)
  // Nothing this brand may see means no envelope at all — an empty payload,
  // not last month's figures for whoever else is on the team.
  if (scope.kind === 'denied') return {}

  const zernio = getZernioClient('inboxanalytics.getInboxVolume')
  const result = await zernio.inboxanalytics.getInboxVolume({
    query: {
      fromDate: params.fromDate,
      ...(params.toDate ? { toDate: params.toDate } : {}),
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
      ...(params.source ? { source: params.source } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('inboxanalytics.getInboxVolume', result as never)

  // The declared response is three aggregates — summary, timeseries,
  // byPlatform — and none of them names an account today. Scoped anyway, so
  // that the day a per-account breakdown appears on the wire it arrives already
  // filtered rather than as a leak nobody is looking for.
  const scoped: Record<string, unknown> = { ...data }
  for (const key of ['data', 'rows', 'timeseries', 'byPlatform', 'byAccount']) {
    const rows = scoped[key]
    if (Array.isArray(rows)) scoped[key] = dropRowsFromOtherAccounts(rows, scope)
  }
  return scoped
}

/* ── Delivery health ───────────────────────────────────────────────────── */

export interface ZernioWebhookDelivery {
  event: string
  status: string
  at?: string
  webhookId?: string
  /** The full body that was sent. A replay surface, if one is ever needed. */
  requestPayload?: Record<string, unknown>
}

/**
 * Did the publisher's own notifications actually arrive?
 *
 * Read-only, and deliberately not put in front of the owner: webhooks are
 * plumbing and "delivery log" is not a sentence a business owner should have to
 * parse. This exists so that when the desk looks stale, the question "were we
 * told?" has an answer that is not a guess.
 */
export async function fetchZernioWebhookDeliveries(params: {
  event?: string
  webhookId?: string
  status?: 'success' | 'failed'
  limit?: number
  skip?: number
} = {}): Promise<ZernioWebhookDelivery[]> {
  const zernio = getZernioClient('webhooks.getWebhookLogs')
  const result = await zernio.webhooks.getWebhookLogs({
    query: {
      ...(params.event ? { event: params.event } : {}),
      ...(params.webhookId ? { webhookId: params.webhookId } : {}),
      ...(params.status ? { status: params.status } : {}),
      limit: params.limit ?? 25,
      ...(params.skip ? { skip: params.skip } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('webhooks.getWebhookLogs', result as never)
  const rows = Array.isArray(data.logs) ? data.logs : Array.isArray(data.data) ? data.data : []

  return rows.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const event = str(rec.event)
    if (!event) return []
    return [{
      event,
      status: str(rec.status) ?? 'unknown',
      ...(str(rec.createdAt) ?? str(rec.deliveredAt)
        ? { at: (str(rec.createdAt) ?? str(rec.deliveredAt))! }
        : {}),
      ...(str(rec.webhookId) ? { webhookId: str(rec.webhookId)! } : {}),
      ...(rec.requestPayload && typeof rec.requestPayload === 'object'
        ? { requestPayload: rec.requestPayload as Record<string, unknown> }
        : {}),
    }]
  })
}
