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
 * Two sources, one seam. A brand linked to a publisher profile is answered from
 * its own accounts. Every other brand is answered "not collected here yet",
 * which is the measured truth — see below. `getMetricsSource()` is the only
 * place that chooses.
 *
 * ── Why the fallback publisher no longer answers ───────────────────────
 * It used to. Twelve of the fourteen businesses fell through to the
 * self-hosted publisher's `reports` endpoint, which returned
 * `404 … could not be found` on EVERY platform, every time. The catch then
 * produced an empty measurement with nothing set on it, so the screen said
 * "nothing is connected" to a health brand that has accounts connected and
 * posts published. That is the worst sentence this desk can print.
 *
 * Measured against the live instance on 2026-08-19, with a valid token:
 *   GET /api/{workspace}/accounts  → 200, the real list
 *   GET /api/{workspace}/posts     → 200
 *   GET /api/{workspace}/tags      → 200
 *   GET /api/{workspace}/reports   → 404   (also /report, /insights,
 *   /statistics, /stats, /metrics, /analytics, /audience, /accounts/{id}/…)
 *
 * The path was wrong too — it omitted the `/api` segment every other call
 * uses — but fixing it changes nothing: this build exposes no results
 * endpoint at all. There is no figure to fetch, so the honest answer is that
 * results are not collected for this business yet, and that is what is
 * returned. Do not reinstate a metrics call here without first getting a 200
 * out of the live instance.
 *
 * ── Honest emptiness: three states, never two ──────────────────────────
 * `empty: true` alone means "there is nothing to show". `problem` means "we
 * tried and could not look" — transient, worth retrying. `notCollected` means
 * "results are not gathered for this business at all" — a real, standing
 * answer with a different action attached. A report that cannot tell the three
 * apart tells a health brand its quiet week was a quiet week when nobody
 * actually read the numbers.
 */

import type { PlatformKey } from '@/lib/mixpost/ui-tokens'
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
  /**
   * Set when results are not gathered for this business at all — the standing
   * answer for every brand that is not linked to a results-capable profile.
   *
   * It is neither `problem` (a failed read, worth retrying) nor bare `empty`
   * (a genuinely quiet period). Screens must print this sentence rather than
   * "nothing is connected": these businesses do have accounts connected and
   * posts published, and telling a health brand otherwise is the fault this
   * field exists to close.
   */
  notCollected?: string
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
  /**
   * One of this brand's own accounts, when the reader has picked one.
   *
   * Null or absent means "everything this brand has on that platform", which
   * is the first matching account. A supplied id is checked against the
   * brand's OWN scoped list before it is used — isolation is ours, so an id
   * from another customer matches nothing and reads nothing.
   */
  accountId?: string | null
}

export type MetricsSource = (
  params: MetricsSourceParams
) => Promise<PlatformMetrics>

// ── Helpers ────────────────────────────────────────────────────────────────

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

/**
 * The sentence a business reads when nobody is gathering its results.
 *
 * No vendor, no endpoint, no department — and deliberately not "connect an
 * account", because these businesses already have accounts connected. The
 * thing that is missing is the measuring, and saying so is the whole point.
 *
 * It also promises nothing. An earlier draft said the Director would set this
 * up, which is a fill this product cannot currently deliver; the owner is
 * pointed at the one place they can ask, and told the truth about the state.
 */
export const RESULTS_NOT_COLLECTED =
  'Results are not being collected for this business yet. Your posts are going out as normal — ' +
  'nobody is gathering the numbers behind them, so there is nothing to show here. ' +
  'Ask in chat if you would like results turned on for this business.'

function notCollectedMetrics(
  platform: PlatformKey,
  from: string,
  to: string
): PlatformMetrics {
  return {
    platform,
    from,
    to,
    empty: true,
    notCollected: RESULTS_NOT_COLLECTED,
    totals: {},
    timeseries: {},
    topPosts: [],
  }
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

/**
 * Which of this brand's accounts a report is for.
 *
 * ── Two faults, one function ───────────────────────────────────────────
 * The picker above the report used to change almost nothing. The report came
 * through a `.find()` that always took the FIRST account on the platform, so a
 * business with two pages on one channel saw the same page whichever it
 * pressed — a control that looks like it works, which is worse than no control.
 *
 * And the id it now carries is resolved HERE, against the brand's own already
 * scoped list, rather than handed upstream on trust. The publisher validates
 * account ids against the whole team, not against a profile, so an id from
 * another customer would be accepted there. Here it simply matches nothing and
 * the report comes back empty — which is the truth from this brand's side.
 * Isolation is ours; a profile is an organisational boundary, not a security one.
 *
 * `null` in, first match out. That is the summary view and it is deliberate.
 */
export function selectAccountForReport<T extends { id: string; platform: string }>(
  accounts: T[],
  platform: string,
  accountId: string | null,
): T | null {
  const onPlatform = accounts.filter(
    (account) => platformKeyOf(account.platform) === platform
  )
  if (!accountId) return onPlatform[0] ?? null
  return onPlatform.find((account) => account.id === accountId) ?? null
}

// ── Publisher-profile source (a brand linked to its own accounts) ───────────

const zernioMetricsSource: MetricsSource = async ({
  platform,
  from,
  to,
  socialUrls,
  accountId,
}) => {
  const profileId = zernioProfileIdFromSocialUrls(socialUrls)
  if (!profileId || !process.env.ZERNIO_API_KEY) {
    return notCollectedMetrics(platform, from, to)
  }

  try {
    const accounts = await fetchZernioAccounts(profileId)
    const match = selectAccountForReport(accounts, platform, accountId ?? null)
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

// ── The rest of the brands ─────────────────────────────────────────────────

/**
 * Every brand that is not linked to a results-capable profile.
 *
 * This used to call the self-hosted publisher's `reports` endpoint. That
 * endpoint does not exist on the running build — see the note at the top of
 * this file for the measurement — so the call 404'd on every platform and the
 * failure was returned as an ordinary empty measurement, which the screen drew
 * as "nothing is connected". Twelve of fourteen businesses read that, and it
 * was false for the ones with accounts connected and posts published.
 *
 * There is nothing to ask, so nothing is asked, and the answer says exactly
 * that. It is the same answer whether the deployment has a publisher
 * configured or not, because in neither case is anyone measuring.
 */
const uncollectedMetricsSource: MetricsSource = async ({ platform, from, to }) =>
  notCollectedMetrics(platform, from, to)

// ── Public ─────────────────────────────────────────────────────────────────

/**
 * Returns the metrics source for a given brand. A linked brand is answered
 * from its own publisher accounts (filtered in our code). Every other brand is
 * told plainly that its results are not collected yet.
 */
export function getMetricsSource(params: MetricsSourceParams): MetricsSource {
  if (zernioProfileIdFromSocialUrls(params.socialUrls) && process.env.ZERNIO_API_KEY) {
    return zernioMetricsSource
  }
  return uncollectedMetricsSource
}

/** Convenience wrapper used by the hook. */
export async function fetchPlatformMetrics(
  params: MetricsSourceParams
): Promise<PlatformMetrics> {
  const source = getMetricsSource(params)
  return source(params)
}
