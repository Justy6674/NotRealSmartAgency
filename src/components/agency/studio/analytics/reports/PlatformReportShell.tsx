'use client'

import { useState } from 'react'
import Link from 'next/link'
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
import { BestTimeCard, EmptyNote } from '../BestTimeCard'
import { NativeInsightsCard } from '../NativeInsightsCard'
import { PostAnalyticsPanel } from '../PostAnalyticsPanel'
import { periodRange, spokenPeriod, type AnalyticsPeriod } from '../analytics-desk'
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
  /** How far back to measure. Chosen once at the top of the screen. */
  period?: AnalyticsPeriod
  /**
   * The account this channel is being read for, when one is selected. Only the
   * account's own extra figures need it — the post figures are already scoped
   * to the business.
   */
  accountId?: string | null
}

const SERIES_TITLES: Record<string, string> = {
  reach: 'People reached',
  impressions: 'Times shown',
  engagement: 'Engagement',
  followers: 'Followers',
  videoViews: 'Video views',
}

const INK_3 = 'oklch(0.615 0.011 240)'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'

/**
 * Shared shell used by every per-platform report.
 *
 * ── What was wrong with it ─────────────────────────────────────────────
 * It rendered "only the charts that have data", which sounds careful and was
 * catastrophic: every source returned an empty timeseries object, so the filter
 * removed every chart on every platform, and ten report components rendered a
 * headline row and nothing else. Silence read as a quiet month.
 *
 * The rule now is the opposite one, and it is the rule the whole desk follows:
 * a frame is either filled or it says why it is not. A chart with no figures
 * prints the sentence that explains it, so "this channel does not send us daily
 * numbers" can never again look identical to "nobody saw your posts".
 *
 * ── Two additions ──────────────────────────────────────────────────────
 * The period is now chosen at the top of the screen and passed down, so a
 * report is never quietly a different length of time from the summary above it.
 * And a post can be opened to see its own curve, which is the only way to tell
 * a post that did well and stopped from one that kept earning for a fortnight.
 */
export function PlatformReportShell({
  platform,
  brandId,
  brandName,
  metrics,
  emptyHint,
  timeseriesSeries = ['engagement'],
  period = '30_days',
  accountId = null,
}: PlatformReportShellProps) {
  const range = periodRange(period)
  const { metrics: report, loading, error, refetch } = useAnalyticsReport({
    brandId,
    platform,
    from: range.from,
    to: range.to,
  })
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const colour = PLATFORM_BRAND_COLOURS[platform]
  const label = PLATFORM_LABELS[platform]

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Loading {label} results…
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <AlertCircle className="h-6 w-6" style={{ color: 'var(--warn, oklch(0.63 0.13 75))' }} />
          <p className="text-sm font-medium text-foreground">
            Couldn&apos;t load your {label} results
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

  // "We could not look" is not "there is nothing there", and a health brand
  // acting on the wrong one of those is how a bad week goes unnoticed. A read
  // that failed with nothing to show takes the whole panel; one that failed
  // with figures still in hand sits as a line above them, so partial numbers
  // are never presented as the full picture.
  if (report?.problem && report.empty) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <AlertCircle className="h-6 w-6" style={{ color: 'var(--warn, oklch(0.63 0.13 75))' }} />
          <p className="text-sm font-medium text-foreground">
            Your {label} figures could not be read
          </p>
          <p className="text-xs max-w-md" style={{ color: INK_3 }}>{report.problem}</p>
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

  // Most businesses are legitimately here: twelve of fourteen have nothing
  // connected. It is a real answer with an action attached, never an empty
  // chart pretending to be a measurement.
  if (!report || report.empty) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: colour }}
          />
          <p className="text-sm font-medium text-foreground">
            No connected {label} account yet
          </p>
          <p className="text-xs max-w-md" style={{ color: INK_3 }}>
            {emptyHint ??
              `Nothing is connected for ${label}, so there is nothing to measure over ${spokenPeriod(period)}. Once an account is connected and a post goes out, the figures appear here on their own.`}
          </p>
          <Link
            href="/agency/social/accounts"
            className="rounded-[8px] px-[12px] py-[7px] text-[12.5px] font-[600]"
            style={{ background: BRAND_DEEP, color: 'var(--brand-ink, oklch(1 0 0))' }}
          >
            Connect an account
          </Link>
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

  // Every requested series gets a frame. A frame with no figures says so.
  const charts = timeseriesSeries.map((series) => {
    const points = report.timeseries?.[series]
    return {
      series,
      title: SERIES_TITLES[series] ?? series,
      labels: points?.map((p) => p.date.slice(5)) ?? [],
      values: points?.map((p) => p.value) ?? [],
    }
  })

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

      {report.problem ? (
        <p
          className="text-[12px]"
          style={{ color: 'var(--care, oklch(0.52 0.150 25))' }}
        >
          {report.problem}
        </p>
      ) : null}

      {/* How current the figures are. Implying "now" when they are two days old
          is the sort of small dishonesty that costs trust in all of them. */}
      {(report.dataStaleness || report.lastSync) && (
        <p className="text-[11.5px]" style={{ color: INK_3 }}>
          {report.dataStaleness
            ? `These figures are ${report.dataStaleness} old.`
            : `Last refreshed ${new Date(report.lastSync as string).toLocaleString('en-AU')}.`}
        </p>
      )}

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

      <div className="grid gap-4 md:grid-cols-2">
        {charts.map((c) => (
          <Card key={c.series}>
            <CardHeader>
              <CardTitle>{c.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {c.values.length > 0 ? (
                <ChartLine
                  labels={c.labels}
                  data={c.values}
                  colour={colour}
                  height={220}
                />
              ) : (
                <EmptyNote>
                  {label} doesn&apos;t send us a day-by-day figure for this yet, so there is nothing
                  to draw. The headline number above is still real.
                </EmptyNote>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <NativeInsightsCard
        brandId={brandId}
        accountId={accountId}
        platform={platform}
        period={period}
        colour={colour}
        channelLabel={label}
      />

      <BestTimeCard
        slots={report.bestTimeToPost ?? []}
        colour={colour}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your best posts</CardTitle>
        </CardHeader>
        <CardContent>
          {report.topPosts.length === 0 ? (
            <EmptyNote>
              Nothing published on {label} in {spokenPeriod(period)}, so there is nothing to rank.
            </EmptyNote>
          ) : (
            <div className="space-y-2">
              {report.topPosts.slice(0, 5).map((post) => (
                <div key={post.id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenPostId((current) => (current === post.id ? null : post.id))
                    }
                    aria-expanded={openPostId === post.id}
                    className="flex w-full items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-left"
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
                        {openPostId === post.id ? 'hide' : 'engagement'}
                      </p>
                    </div>
                  </button>

                  {openPostId === post.id ? (
                    <PostAnalyticsPanel
                      brandId={brandId}
                      postId={post.id}
                      period={period}
                      caption={post.caption}
                      colour={colour}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
