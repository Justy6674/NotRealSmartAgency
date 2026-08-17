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
 * Cross-platform analytics summary. Fetches each platform in parallel
 * via the studio analytics endpoint. If a brand is Zernio-linked, the
 * same endpoint already selects the right backend. If the platform returns
 * no data, we attempt /api/zernio/analytics as a fallback — it is
 * session-scoped and returns null when the brand is not linked.
 *
 * Empty platforms (no connected account) are silently skipped, not errored.
 * We never print the name of any publishing or analytics vendor to the user.
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

            // Primary endpoint (studio analytics — uses Zernio or Mixpost
            // depending on how the brand is configured server-side)
            const res = await fetch(`/api/studio/analytics?${params.toString()}`)
            if (res.ok) {
              const data = (await res.json()) as PlatformMetrics
              if (!data.empty) return [platform, data] as const
            }

            // Fallback: direct Zernio analytics route (exists when backend
            // agent has landed it; returns 404 otherwise — handled gracefully)
            const zernioParams = new URLSearchParams({ brandId, platform })
            if (from) zernioParams.set('from', from)
            if (to) zernioParams.set('to', to)
            const zRes = await fetch(`/api/zernio/analytics?${zernioParams.toString()}`)
            if (zRes.ok) {
              const zData = (await zRes.json()) as PlatformMetrics
              return [platform, zData] as const
            }

            return [platform, null] as const
          } catch {
            return [platform, null] as const
          }
        })
      )

      if (cancelled) return

      const next: Record<PlatformKey, PlatformMetrics | null> = { ...initialReports }
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
        <Loader2
          className="h-4 w-4 animate-spin"
          style={{ color: 'var(--brand, oklch(0.545 0.115 240))' }}
        />
        <p className="text-[13px]" style={{ color: 'oklch(0.615 0.011 240)' }}>
          Pulling in your numbers…
        </p>
      </div>
    )
  }

  if (summary.connectedPlatforms === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-[10px] py-12 text-center">
          <Trophy className="h-6 w-6" style={{ color: 'oklch(0.615 0.011 240)' }} />
          <p
            className="text-[14px] font-[600]"
            style={{ color: 'var(--brand-deep, oklch(0.33 0.08 240))' }}
          >
            No accounts connected yet
          </p>
          <p className="text-[12.5px] max-w-md" style={{ color: 'oklch(0.615 0.011 240)' }}>
            Connect a social account under Social → Accounts to start collecting
            results. Once a channel is connected, its metrics appear here
            automatically.
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
          <CardTitle
            className="text-[13.5px] font-[600]"
            style={{ color: 'var(--brand-deep, oklch(0.33 0.08 240))' }}
          >
            Channels ({summary.connectedPlatforms} active)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-2 md:grid-cols-5">
            {ALL_PLATFORMS.map((platform) => {
              const report = state.reports[platform]
              const connected = report && !report.empty
              return (
                <div
                  key={platform}
                  className="flex items-center gap-2 rounded-[5px] border px-3 py-[7px]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span
                    className="h-[7px] w-[7px] rounded-full shrink-0"
                    style={{
                      background: connected
                        ? PLATFORM_BRAND_COLOURS[platform]
                        : 'oklch(0.5 0 0 / 0.25)',
                    }}
                  />
                  <span
                    className="text-[12px] font-[500] truncate"
                    style={{
                      color: connected
                        ? 'var(--foreground)'
                        : 'oklch(0.615 0.011 240)',
                    }}
                  >
                    {PLATFORM_LABELS[platform]}
                  </span>
                  {connected && (
                    <span
                      className="ml-auto text-[10px] tabular-nums shrink-0"
                      style={{ color: 'oklch(0.615 0.011 240)' }}
                    >
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
            <CardTitle
              className="flex items-center gap-2 text-[13.5px] font-[600]"
              style={{ color: 'var(--brand-deep, oklch(0.33 0.08 240))' }}
            >
              <Trophy className="h-4 w-4" style={{ color: 'oklch(0.72 0.15 70)' }} />
              Top channel — {PLATFORM_LABELS[summary.topPlatform.platform]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[12.5px]" style={{ color: 'oklch(0.615 0.011 240)' }}>
              Highest total engagement this period:{' '}
              <span
                className="font-[600] tabular-nums"
                style={{ color: 'var(--brand-deep, oklch(0.33 0.08 240))' }}
              >
                {summary.topPlatform.engagement.toLocaleString()}
              </span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
