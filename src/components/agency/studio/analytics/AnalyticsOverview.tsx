'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Eye,
  Heart,
  TrendingUp,
  Users,
  Trophy,
  Loader2,
} from 'lucide-react'
import { DirectorAssistBar } from '@/components/agency/studio/DirectorAssistBar'
import {
  PLATFORM_BRAND_COLOURS,
  PLATFORM_LABELS,
  type PlatformKey,
} from '@/lib/mixpost/ui-tokens'
import type { PlatformMetrics } from '@/lib/analytics/platform-metrics'
import { MetricCard } from './MetricCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ZernioAnalyticsPanel } from './ZernioAnalyticsPanel'
import { ZernioAdsDataGrid } from './ZernioAdsDataGrid'

export interface AnalyticsOverviewProps {
  brandId: string
  brandName?: string
  /** Optional ISO date range. Defaults to last 28 days. */
  from?: string
  to?: string
}

const ALL_PLATFORMS: PlatformKey[] = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
  'pinterest',
  'threads',
  'bluesky',
  'mastodon',
]

interface OverviewState {
  loading: boolean
  reports: Record<PlatformKey, PlatformMetrics | null>
}

const initialReports: Record<PlatformKey, PlatformMetrics | null> = {
  facebook: null,
  instagram: null,
  linkedin: null,
  twitter: null,
  tiktok: null,
  youtube: null,
  pinterest: null,
  threads: null,
  bluesky: null,
  mastodon: null,
}

/**
 * Cross-platform analytics summary. Fetches all 10 platform reports in
 * parallel via the same endpoint each platform tab uses, then sums the
 * totals into a single dashboard.
 *
 * Empty platforms (no connected account) are silently skipped, not errored.
 */
export function AnalyticsOverview({ brandId, brandName, from, to }: AnalyticsOverviewProps) {
  const [state, setState] = useState<OverviewState>({
    loading: true,
    reports: { ...initialReports },
  })

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, reports: { ...initialReports } })

    const fetchAll = async () => {
      const results = await Promise.all(
        ALL_PLATFORMS.map(async (platform) => {
          try {
            const params = new URLSearchParams({ brandId, platform })
            if (from) params.set('from', from)
            if (to) params.set('to', to)
            const res = await fetch(
              `/api/studio/analytics?${params.toString()}`
            )
            if (!res.ok) return [platform, null] as const
            const data = (await res.json()) as PlatformMetrics
            return [platform, data] as const
          } catch {
            return [platform, null] as const
          }
        })
      )

      if (cancelled) return

      const next: Record<PlatformKey, PlatformMetrics | null> = {
        ...initialReports,
      }
      for (const [platform, data] of results) {
        next[platform] = data
      }
      setState({ loading: false, reports: next })
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [brandId, from, to])

  const summary = useMemo(() => {
    let totalReach = 0
    let totalImpressions = 0
    let totalEngagement = 0
    let totalFollowers = 0
    let topPlatform: { platform: PlatformKey; engagement: number } | null = null
    let connectedPlatforms = 0

    for (const platform of ALL_PLATFORMS) {
      const report = state.reports[platform]
      if (!report || report.empty) continue
      connectedPlatforms += 1
      const t = report.totals
      totalReach += t.reach ?? 0
      totalImpressions += t.impressions ?? 0
      totalEngagement += t.engagement ?? 0
      totalFollowers += t.followers ?? 0
      const engagement = t.engagement ?? 0
      if (!topPlatform || engagement > topPlatform.engagement) {
        topPlatform = { platform, engagement }
      }
    }

    return {
      totalReach,
      totalImpressions,
      totalEngagement,
      totalFollowers,
      topPlatform,
      connectedPlatforms,
    }
  }, [state.reports])

  if (state.loading) {
    return (
      <div className="flex items-center justify-center p-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Aggregating cross-platform analytics...
        </p>
      </div>
    )
  }

  if (summary.connectedPlatforms === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <Trophy className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            No connected accounts yet
          </p>
          <p className="text-xs text-muted-foreground max-w-md">
            Connect a social account in Settings to start collecting analytics.
            Once a platform is connected, its metrics appear here automatically.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Director Assist */}
      <DirectorAssistBar
        brandName={brandName ?? null}
        buttons={[
          {
            label: "What's working?",
            prompt: `Give me a quick performance summary for ${brandName ?? 'this brand'}. Use query_analytics and query_social_analytics to pull real data. What content types, platforms and posting times are performing best? Keep it concise with actionable takeaways.`,
          },
          {
            label: 'Full performance review',
            prompt: `Run a detailed cross-platform performance analysis for ${brandName ?? 'this brand'}. Use query_analytics and query_social_analytics to get real data from every connected platform. Compare engagement rates, reach, follower growth and content performance. Identify trends, winning patterns, underperformers, and specific recommendations to improve results over the next 30 days.`,
          },
        ]}
      />

      <ZernioAnalyticsPanel brandId={brandId} from={from} to={to} />
      <ZernioAdsDataGrid brandId={brandId} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total reach"
          value={summary.totalReach}
          icon={<Eye className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Total impressions"
          value={summary.totalImpressions}
          icon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Total engagement"
          value={summary.totalEngagement}
          icon={<Heart className="h-3.5 w-3.5" />}
        />
        <MetricCard
          label="Total followers"
          value={summary.totalFollowers}
          icon={<Users className="h-3.5 w-3.5" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connected platforms ({summary.connectedPlatforms})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
            {ALL_PLATFORMS.map((platform) => {
              const report = state.reports[platform]
              const connected = report && !report.empty
              return (
                <div
                  key={platform}
                  className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: connected
                        ? PLATFORM_BRAND_COLOURS[platform]
                        : 'oklch(0.5 0 0 / 0.3)',
                    }}
                  />
                  <span className="text-xs font-medium text-foreground">
                    {PLATFORM_LABELS[platform]}
                  </span>
                  {connected && (
                    <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                      {(report.totals.engagement ?? 0).toLocaleString()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {summary.topPlatform && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top platform —{' '}
              {PLATFORM_LABELS[summary.topPlatform.platform]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Highest total engagement this period:{' '}
              <span className="font-semibold text-foreground tabular-nums">
                {summary.topPlatform.engagement.toLocaleString()}
              </span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
