'use client'

import { Loader2, AlertCircle, BarChart3, Sparkles } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import {
  PLATFORM_BRAND_COLOURS,
  PLATFORM_LABELS,
  type PlatformKey,
} from '@/lib/mixpost/ui-tokens'
import { useAnalyticsReport } from '@/hooks/useAnalyticsReport'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricCard } from '../MetricCard'
import { ChartLine } from '../ChartLine'
import { ChartBar } from '../ChartBar'
import type { MetricCardProps } from '../MetricCard'

export interface ReportMetricSpec {
  label: string
  /** Function that pulls the metric out of the report totals. */
  pick: (totals: Record<string, number | undefined>) => number | undefined
  icon?: MetricCardProps['icon']
}

export interface PlatformReportShellProps {
  platform: PlatformKey
  brandId: string
  brandName?: string
  /** Headline metric cards to render across the top. */
  metrics: ReportMetricSpec[]
  /** Optional note shown when no data is available (e.g. "API limited"). */
  emptyHint?: string
  /** Show daily timeseries chart for these series, if data exists. */
  timeseriesSeries?: Array<'reach' | 'impressions' | 'engagement' | 'followers' | 'videoViews'>
}

/**
 * Shared shell used by every per-platform report. Owns the loading,
 * error and empty states so the per-platform components stay tiny and
 * declarative — they just specify which metrics matter for that platform.
 */
export function PlatformReportShell({
  platform,
  brandId,
  brandName,
  metrics,
  emptyHint,
  timeseriesSeries = ['engagement'],
}: PlatformReportShellProps) {
  const { metrics: report, loading, error, refetch } = useAnalyticsReport({
    brandId,
    platform,
  })
  const colour = PLATFORM_BRAND_COLOURS[platform]
  const label = PLATFORM_LABELS[platform]

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Loading {label} analytics...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <AlertCircle className="h-6 w-6 text-rose-500" />
          <p className="text-sm font-medium text-foreground">
            Couldn&apos;t load {label} analytics
          </p>
          <p className="text-xs text-muted-foreground max-w-md">{error}</p>
          <button
            type="button"
            onClick={refetch}
            className="text-xs text-foreground underline underline-offset-2"
          >
            Try again
          </button>
        </CardContent>
      </Card>
    )
  }

  if (!report || report.empty) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: colour }}
          />
          <p className="text-sm font-medium text-foreground">
            No {label} data yet
          </p>
          <p className="text-xs text-muted-foreground max-w-md">
            {emptyHint ??
              `Connect a ${label} account in Settings to start collecting analytics. Once posts are published, metrics will appear here automatically.`}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Coerce totals to a Record so the spec.pick callbacks can read it.
  const totalsRecord = report.totals as Record<string, number | undefined>
  const deltasRecord = (report.deltas ?? {}) as Record<
    string,
    number | undefined
  >

  // Pick which timeseries to render — only those that have data.
  const charts = timeseriesSeries
    .map((series) => {
      const points = report.timeseries?.[series]
      if (!points || points.length === 0) return null
      return {
        series,
        labels: points.map((p) => p.date.slice(5)),
        values: points.map((p) => p.value),
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {metrics.map((metric) => {
          const value = metric.pick(totalsRecord)
          const delta = metric.pick(deltasRecord)
          return (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={value ?? '—'}
              delta={delta}
              icon={metric.icon}
            />
          )
        })}
      </div>

      {/* Director Assist — platform-specific improvement advice */}
      <button
        type="button"
        onClick={() =>
          sendToDirector(
            `How do I improve my ${label} performance for ${brandName ?? 'this brand'}? Use query_social_analytics to pull real ${label} data, then give me specific, actionable advice — best content types, posting times, hashtag strategy, and anything I should stop or start doing on ${label}.`
          )
        }
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colours"
      >
        <Sparkles className="h-3 w-3" />
        How do I improve?
      </button>

      {charts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {charts.map((c) => (
            <Card key={c.series}>
              <CardHeader>
                <CardTitle className="capitalize">{c.series}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartLine
                  labels={c.labels}
                  data={c.values}
                  colour={colour}
                  height={220}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {report.bestTimeToPost && report.bestTimeToPost.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Best time to post</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartBar
              labels={report.bestTimeToPost.map(
                (b) => `${b.hour.toString().padStart(2, '0')}:00`
              )}
              data={report.bestTimeToPost.map((b) => b.engagement)}
              colour={colour}
              height={220}
              yLabel="Engagement"
            />
          </CardContent>
        </Card>
      )}

      {report.topPosts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {report.topPosts.slice(0, 5).map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2"
                >
                  {post.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={post.thumbnailUrl}
                      alt=""
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-foreground">
                      {post.caption || '(no caption)'}
                    </p>
                    {post.publishedAt && (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(post.publishedAt).toLocaleDateString('en-AU')}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {post.engagement.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      engagement
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
