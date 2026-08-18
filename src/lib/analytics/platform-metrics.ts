/**
 * One platform's results for one brand — the source behind every report page.
 *
 * ── The fault this file closes ─────────────────────────────────────────
 * Every source here used to return `timeseries: {}` and `topPosts: []` as
 * literals, and the report shell then rendered "only the charts that have
 * data", which was always none. Ten report components, forty lines of chart
 * each, that could never draw a single pixel — with no error anywhere, so the
 * screen looked like a quiet month rather than a broken pipe. The figures were
 * live upstream the whole time.
 *
 * Three sources, one seam. A brand linked to a publisher profile is answered
 * from its own accounts; Mixpost answers the rest; the stub answers a
 * deployment with neither. `getMetricsSource()` is the only place that chooses.
 *
 * ── Honest emptiness ───────────────────────────────────────────────────
 * `empty: true` means "there is nothing to show". `problem` means "we could not
 * look". A report that cannot tell those apart tells a health brand its quiet
 * week was a quiet week when nobody actually read the numbers, so both are
 * carried separately and the shell prints whichever applies.
 */

import type { PlatformKey } from '@/lib/mixpost/ui-tokens'
import {
  fetchMixpostReports,
  fetchMixpostAccounts,
  type MixpostAccount,
} from '@/lib/mixpost/client'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { fetchZernioAccounts } from '@/lib/zernio/client'
import { zernioOwnerMessage } from '@/lib/zernio/errors'
import { fetchZernioFollowerStats } from '@/lib/zernio/accounts'
import {
  fetchZernioAnalyticsReport,
  fetchZernioBestTimeToPost,
  fetchZernioDailyMetrics,
  type ZernioDailyPoint,
} from '@/lib/zernio/insights'

// ── Types ──────────────────────────────────────────────────────────────────

export interface MetricTimeseriesPoint {
  /** ISO date string (YYYY-MM-DD) */
  date: string
  value: number
}

export interface TopPostMetric {
  id: string
  caption: string
  thumbnailUrl?: string | null
  publishedAt?: string | null
  engagement: number
  reach?: number
  impressions?: number
  url?: string | null
}

/**
 * A busy hour for this account.
 *
 * `hourUtc` is UTC, and it is named that way because the endpoint's hours are
 * UTC and printing them beside an Australian clock without saying so moves
 * every recommendation by ten hours. The conversion belongs in the browser,
 * which is the only layer that knows the reader's own timezone.
 */
export interface BestTimeSlot {
  /** 0 = Monday on this endpoint — NOT the posting queue's 0 = Sunday. */
  dayOfWeek: number
  hourUtc: number
  engagement: number
  postCount: number
}

export interface PlatformMetrics {
  platform: PlatformKey
  /** ISO date the report period starts (inclusive). */
  from: string
  /** ISO date the report period ends (inclusive). */
  to: string
  /** True when there is genuinely nothing to show for this brand here. */
  empty: boolean
  /**
   * Set when the figures could NOT be read. Distinct from `empty`, and written
   * for the owner rather than copied from upstream.
   */
  problem?: string
  /** Headline numbers. Any field may be undefined depending on platform. */
  totals: {
    reach?: number
    impressions?: number
    engagement?: number
    followers?: number
    followerGrowth?: number
    profileVisits?: number
    clicks?: number
    videoViews?: number
    watchTimeSeconds?: number
    saves?: number
    shares?: number
    comments?: number
    likes?: number
  }
  /** Period-over-period delta (totals from current vs previous period). */
  deltas?: Partial<PlatformMetrics['totals']>
  /** Daily timeseries — one entry per metric series the platform supports. */
  timeseries: {
    reach?: MetricTimeseriesPoint[]
    impressions?: MetricTimeseriesPoint[]
    engagement?: MetricTimeseriesPoint[]
    followers?: MetricTimeseriesPoint[]
    videoViews?: MetricTimeseriesPoint[]
  }
  /** When this account's figures were last refreshed upstream. */
  lastSync?: string
  /** How old the numbers are, in upstream's own words. */
  dataStaleness?: string
  /** Best time to post, from this brand's own results. */
  bestTimeToPost?: BestTimeSlot[]
  topPosts: TopPostMetric[]
}

export interface MetricsSourceParams {
  brandId: string
  platform: PlatformKey
  /** ISO date (YYYY-MM-DD) */
  from: string
  /** ISO date (YYYY-MM-DD) */
  to: string
  socialUrls?: unknown
}

export type MetricsSource = (
  params: MetricsSourceParams
) => Promise<PlatformMetrics>

// ── Helpers ────────────────────────────────────────────────────────────────

const PLATFORM_TO_PROVIDERS: Record<PlatformKey, string[]> = {
  facebook: ['facebook_page', 'facebook_group'],
  instagram: ['instagram'],
  linkedin: ['linkedin', 'linkedin_page'],
  twitter: ['x', 'twitter'],
  tiktok: ['tiktok'],
  youtube: ['youtube'],
  pinterest: ['pinterest'],
  threads: ['threads'],
  bluesky: ['bluesky'],
  mastodon: ['mastodon'],
}

function emptyMetrics(
  platform: PlatformKey,
  from: string,
  to: string,
  problem?: string
): PlatformMetrics {
  return {
    platform,
    from,
    to,
    empty: true,
    ...(problem ? { problem } : {}),
    totals: {},
    timeseries: {},
    topPosts: [],
  }
}

function findAccountForPlatform(
  accounts: MixpostAccount[],
  platform: PlatformKey
): MixpostAccount | null {
  const providers = PLATFORM_TO_PROVIDERS[platform]
  return accounts.find((a) => providers.includes(a.provider)) ?? null
}

function periodFromRange(from: string, to: string): string {
  const start = new Date(from)
  const end = new Date(to)
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  )
  // Mixpost period codes — fall back to "month" for anything > 28 days.
  if (days <= 7) return 'week'
  if (days <= 31) return 'month'
  return 'quarter'
}

function safeNum(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/** Normalise a platform name to the keys this UI uses. */
function platformKeyOf(raw: string): string {
  const lower = raw.toLowerCase().replace(/_(page|group|business)$/, '')
  return lower === 'x' ? 'twitter' : lower
}

/**
 * Engagement is not reported directly by every network, so it is derived when
 * absent rather than shown as zero — a zero here reads as "nobody engaged",
 * which is a different claim from "this network does not send us that number".
 */
function engagementOf(metrics: Record<string, number>): number | undefined {
  if (typeof metrics.engagement === 'number') return metrics.engagement
  const parts = ['likes', 'comments', 'shares', 'saves', 'reactions']
    .map((key) => metrics[key])
    .filter((value): value is number => typeof value === 'number')
  if (parts.length === 0) return undefined
  return parts.reduce((sum, value) => sum + value, 0)
}

/** Read one day's figures for a platform, falling back to the day's totals. */
function dayMetrics(point: ZernioDailyPoint, platform: string): Record<string, number> {
  for (const [key, value] of Object.entries(point.platformMetrics)) {
    if (platformKeyOf(key) === platform) return value
  }
  // A single-account brand's daily totals ARE that platform's figures. Reading
  // them for a brand with several networks would over-count, so this only
  // applies when the per-platform block is absent entirely.
  return Object.keys(point.platformMetrics).length === 0 ? point.metrics : {}
}

function seriesOf(
  daily: ZernioDailyPoint[],
  platform: string,
  pick: (metrics: Record<string, number>) => number | undefined
): MetricTimeseriesPoint[] | undefined {
  const points = daily.flatMap((point) => {
    const value = pick(dayMetrics(point, platform))
    return value === undefined ? [] : [{ date: point.date, value }]
  })
  return points.length > 0 ? points : undefined
}

function sum(points: MetricTimeseriesPoint[] | undefined): number | undefined {
  if (!points || points.length === 0) return undefined
  return points.reduce((total, point) => total + point.value, 0)
}

// ── Publisher-profile source (a brand linked to its own accounts) ───────────

const zernioMetricsSource: MetricsSource = async ({
  platform,
  from,
  to,
  socialUrls,
}) => {
  const profileId = zernioProfileIdFromSocialUrls(socialUrls)
  if (!profileId || !process.env.ZERNIO_API_KEY) {
    return emptyMetrics(platform, from, to)
  }

  try {
    const accounts = await fetchZernioAccounts(profileId)
    const match = accounts.find((account) => platformKeyOf(account.platform) === platform)
    if (!match) return emptyMetrics(platform, from, to)

    // Four reads, none of which depends on another. `allSettled` because one
    // endpoint being unavailable must not blank a page the other three could
    // have filled — a report that fails whole is a report nobody trusts.
    const [reportResult, dailyResult, slotsResult, followerResult] = await Promise.allSettled([
      fetchZernioAnalyticsReport({
        profileId,
        accountId: match.id,
        platform: match.platform,
        fromDate: from,
        toDate: to,
        sortBy: 'engagement',
        limit: 25,
      }),
      fetchZernioDailyMetrics({
        accountId: match.id,
        platform: match.platform,
        fromDate: from,
        toDate: to,
      }),
      fetchZernioBestTimeToPost({ profileId, accountId: match.id }),
      fetchZernioFollowerStats({ profileId, fromDate: from, toDate: to }),
    ])

    const report = reportResult.status === 'fulfilled' ? reportResult.value : null
    const daily = dailyResult.status === 'fulfilled' ? dailyResult.value : []
    const slots = slotsResult.status === 'fulfilled' ? slotsResult.value : []
    const followerStats = followerResult.status === 'fulfilled' ? followerResult.value : {}

    // A read that failed is recorded, never folded into "nothing happened".
    // Settling each call independently is what keeps one outage from blanking
    // the page — but silently returning fewer numbers because a call failed is
    // the same lie in a smaller font, so the failure travels with the figures.
    for (const failed of [reportResult, dailyResult, slotsResult, followerResult]) {
      if (failed.status === 'rejected') console.error('[analytics] read failed', failed.reason)
    }
    const readFailed =
      reportResult.status === 'rejected' || dailyResult.status === 'rejected'

    const timeseries: PlatformMetrics['timeseries'] = {}
    const reach = seriesOf(daily, platform, (m) => m.reach)
    const impressions = seriesOf(daily, platform, (m) => m.impressions)
    const engagement = seriesOf(daily, platform, engagementOf)
    const videoViews = seriesOf(daily, platform, (m) => m.views ?? m.videoViews)
    if (reach) timeseries.reach = reach
    if (impressions) timeseries.impressions = impressions
    if (engagement) timeseries.engagement = engagement
    if (videoViews) timeseries.videoViews = videoViews

    const followers = (followerStats[match.id] ?? []).map((point) => ({
      date: point.date,
      value: point.followers,
    }))
    if (followers.length > 0) timeseries.followers = followers

    // Each series is computed once and then summed — the naive version read
    // the daily rows twice per metric.
    const likes = seriesOf(daily, platform, (m) => m.likes)
    const comments = seriesOf(daily, platform, (m) => m.comments)
    const shares = seriesOf(daily, platform, (m) => m.shares)
    const saves = seriesOf(daily, platform, (m) => m.saves)
    const clicks = seriesOf(daily, platform, (m) => m.clicks)

    const totals: PlatformMetrics['totals'] = {}
    const addTotal = (
      key: keyof PlatformMetrics['totals'],
      points: MetricTimeseriesPoint[] | undefined,
    ) => {
      const total = sum(points)
      if (total !== undefined) totals[key] = total
    }
    addTotal('reach', reach)
    addTotal('impressions', impressions)
    addTotal('engagement', engagement)
    addTotal('videoViews', videoViews)
    addTotal('likes', likes)
    addTotal('comments', comments)
    addTotal('shares', shares)
    addTotal('saves', saves)
    addTotal('clicks', clicks)

    // Followers is a level, not a sum: the last reading in the window is the
    // count, and the difference across it is the growth.
    if (followers.length > 0) {
      totals.followers = followers[followers.length - 1].value
      totals.followerGrowth = followers[followers.length - 1].value - followers[0].value
    }

    const topPosts: TopPostMetric[] = (report?.posts ?? [])
      .filter((post) =>
        post.platforms.length === 0 || post.platforms.some((p) => platformKeyOf(p) === platform))
      .map((post) => ({
        id: post.id,
        caption: post.content,
        thumbnailUrl: post.thumbnailUrl ?? null,
        publishedAt: post.publishedAt ?? null,
        engagement: engagementOf(post.metrics) ?? 0,
        ...(post.metrics.reach !== undefined ? { reach: post.metrics.reach } : {}),
        ...(post.metrics.impressions !== undefined
          ? { impressions: post.metrics.impressions }
          : {}),
        url: post.platformPostUrl ?? null,
      }))
      .sort((a, b) => b.engagement - a.engagement)

    const bestTimeToPost: BestTimeSlot[] = slots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      hourUtc: slot.hourUtc,
      engagement: slot.averageEngagement,
      postCount: slot.postCount,
    }))

    const hasAnything =
      Object.keys(totals).length > 0 ||
      topPosts.length > 0 ||
      Object.keys(timeseries).length > 0

    return {
      platform,
      from,
      to,
      empty: !hasAnything,
      ...(readFailed
        ? {
            problem: hasAnything
              ? 'Some of these figures could not be read this time, so this page may be short. What is shown is real.'
              : 'These figures could not be read just now. Nothing has been changed — try again in a moment.',
          }
        : {}),
      totals,
      timeseries,
      ...(report?.overview.lastSync ? { lastSync: report.overview.lastSync } : {}),
      ...(report?.overview.dataStaleness
        ? { dataStaleness: report.overview.dataStaleness }
        : {}),
      ...(bestTimeToPost.length > 0 ? { bestTimeToPost } : {}),
      topPosts,
    }
  } catch (err) {
    return emptyMetrics(
      platform,
      from,
      to,
      zernioOwnerMessage('analytics', err),
    )
  }
}

// ── Mixpost-backed source (fallback for brands without a publisher profile) ─

const mixpostMetricsSource: MetricsSource = async ({
  platform,
  from,
  to,
}) => {
  const accounts = (await fetchMixpostAccounts()) ?? []
  const account = findAccountForPlatform(accounts, platform)

  if (!account) {
    return emptyMetrics(platform, from, to)
  }

  const period = periodFromRange(from, to)
  const report = await fetchMixpostReports(account.id, period)

  if (!report || !report.metrics) {
    return emptyMetrics(platform, from, to)
  }

  const m = report.metrics as Record<string, unknown>

  // Mixpost reports have wildly different shapes per platform — coerce
  // gently and fall through to undefined for fields the platform doesn't
  // expose. Components must handle missing fields gracefully.
  const totals: PlatformMetrics['totals'] = {
    reach: safeNum(m.reach ?? m.total_reach),
    impressions: safeNum(m.impressions ?? m.total_impressions),
    engagement: safeNum(m.engagement ?? m.total_engagement),
    followers: safeNum(m.followers ?? m.followers_count),
    followerGrowth: safeNum(m.follower_growth ?? m.new_followers),
    profileVisits: safeNum(m.profile_visits),
    clicks: safeNum(m.clicks ?? m.link_clicks),
    videoViews: safeNum(m.video_views ?? m.views),
    watchTimeSeconds: safeNum(m.watch_time ?? m.watch_time_seconds),
    saves: safeNum(m.saves),
    shares: safeNum(m.shares),
    comments: safeNum(m.comments),
    likes: safeNum(m.likes),
  }

  const hasAnyTotal = Object.values(totals).some((v) => v !== undefined)

  // The self-hosted reports endpoint returns headline numbers only — no daily
  // series and no per-post table. Stated here rather than left as an empty
  // object, so the shell can say "not collected on this channel" instead of
  // drawing a frame around nothing.
  return {
    platform,
    from,
    to,
    empty: !hasAnyTotal,
    totals,
    timeseries: {},
    topPosts: [],
  }
}

// ── Stub source (used when no publisher is configured at all) ───────────────

const stubMetricsSource: MetricsSource = async ({ platform, from, to }) => {
  return emptyMetrics(platform, from, to)
}

// ── Public ─────────────────────────────────────────────────────────────────

/**
 * Returns the metrics source for a given brand. A linked brand is answered
 * from its own publisher accounts (filtered in our code). Mixpost is the
 * fallback for every other brand.
 */
export function getMetricsSource(params: MetricsSourceParams): MetricsSource {
  if (zernioProfileIdFromSocialUrls(params.socialUrls) && process.env.ZERNIO_API_KEY) {
    return zernioMetricsSource
  }
  if (process.env.NEXT_PUBLIC_MIXPOST_DISABLED === 'true') {
    return stubMetricsSource
  }
  return mixpostMetricsSource
}

/** Convenience wrapper used by the hook. */
export async function fetchPlatformMetrics(
  params: MetricsSourceParams
): Promise<PlatformMetrics> {
  const source = getMetricsSource(params)
  return source(params)
}
