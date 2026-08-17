/**
 * Platform analytics metrics — abstracted source layer.
 *
 * During the Mixpost-port transition, metrics are pulled from the Mixpost
 * reports endpoint via `fetchMixpostReports`. After Phase 10 ships direct
 * platform OAuth, the source switches to native platform APIs without any
 * UI changes — `getMetricsSource()` is the single seam.
 *
 * For brands with no connected account on a given platform, the source
 * returns an empty `PlatformMetrics` shell so report pages render an empty
 * state instead of erroring.
 */

import type { PlatformKey } from '@/lib/mixpost/ui-tokens'
import {
  fetchMixpostReports,
  fetchMixpostAccounts,
  type MixpostAccount,
} from '@/lib/mixpost/client'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { fetchZernioAccounts, fetchZernioAnalytics } from '@/lib/zernio/client'

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

export interface PlatformMetrics {
  platform: PlatformKey
  /** ISO date the report period starts (inclusive). */
  from: string
  /** ISO date the report period ends (inclusive). */
  to: string
  /** True when no data is available for this brand on this platform. */
  empty: boolean
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
  /** Best time to post — hour-of-day buckets, 0-23. */
  bestTimeToPost?: { hour: number; engagement: number }[]
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
  to: string
): PlatformMetrics {
  return {
    platform,
    from,
    to,
    empty: true,
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

  const accounts = await fetchZernioAccounts(profileId)
  const match = accounts.find((account) => {
    const key = account.platform.toLowerCase().replace(/_(page|group)$/, '')
    return key === platform || account.platform.toLowerCase() === platform
  })
  if (!match) return emptyMetrics(platform, from, to)

  const analytics = await fetchZernioAnalytics({
    profileId,
    accountId: match.id,
    platform: match.platform,
    fromDate: from,
    toDate: to,
  })
  if (!analytics) return emptyMetrics(platform, from, to)

  const row = analytics.platformBreakdown.find(
    (item) => item.platform.toLowerCase() === match.platform.toLowerCase(),
  )
  const totals: PlatformMetrics['totals'] = {
    reach: row?.reach,
    impressions: row?.impressions,
    likes: row?.likes,
    comments: row?.comments,
    shares: row?.shares,
    saves: row?.saves,
    clicks: row?.clicks,
    videoViews: row?.views,
  }
  const hasAnyTotal = Object.values(totals).some((v) => v !== undefined)

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

// ── Stub source (used when MIXPOST is unconfigured) ────────────────────────

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
