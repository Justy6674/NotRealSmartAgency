'use client'

import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartLine } from './ChartLine'
import { EmptyNote } from './BestTimeCard'
import { usePostTimeline, type AnalyticsPeriod } from './analytics-desk'

/**
 * One post, over time.
 *
 * ── Why a curve and not a number ───────────────────────────────────────
 * A single lifetime figure cannot tell you whether a post did well on the day
 * and stopped, or kept earning for a fortnight. Those two posts want opposite
 * decisions — one is a format to repeat, the other is a format to boost — and
 * they look identical in a table of totals.
 *
 * The reading is cumulative, so the headline is the LAST value on the curve,
 * never the sum of the readings. Summing a running total produces a number
 * that never happened.
 *
 * The figures are read for posts published here and for posts published by
 * hand somewhere else, which is the only way the second kind ever appears on
 * this desk at all.
 */

const LINE = 'var(--line, oklch(0.915 0.007 240))'
const INK_3 = 'oklch(0.615 0.011 240)'
const BRAND = 'var(--brand, oklch(0.545 0.03 240))'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'

const METRIC_LABELS: Record<string, string> = {
  impressions: 'Times shown',
  reach: 'People reached',
  likes: 'Likes',
  comments: 'Comments',
  shares: 'Shares',
  saves: 'Saves',
  clicks: 'Clicks',
  views: 'Views',
  follows: 'New followers',
  engagement: 'Engagement',
}

/** Plainest first — this order decides which curve gets drawn. */
const PREFERRED = ['reach', 'impressions', 'views', 'engagement', 'likes', 'clicks']

export function prettyMetric(key: string): string {
  const known = METRIC_LABELS[key]
  if (known) return known
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export interface PostAnalyticsPanelProps {
  brandId: string
  postId: string
  period: AnalyticsPeriod
  /** Shown as the panel's subject so the reader knows which post this is. */
  caption?: string
  colour?: string
}

export function PostAnalyticsPanel({
  brandId,
  postId,
  period,
  caption,
  colour = 'oklch(0.545 0.03 240)',
}: PostAnalyticsPanelProps) {
  const timeline = usePostTimeline({ brandId, postId, period })

  const chartKey =
    PREFERRED.find((key) => timeline.metricKeys.includes(key)) ?? timeline.metricKeys[0]

  const points = chartKey
    ? timeline.points.map((point) => ({
        date: point.at.slice(0, 10),
        value: point.metrics[chartKey] ?? 0,
      }))
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13.5px] font-[600]" style={{ color: BRAND_DEEP }}>
          How this post has done
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-[12px]">
        {caption ? (
          <p className="line-clamp-2 text-[12.5px]" style={{ color: INK_3 }}>
            {caption}
          </p>
        ) : null}

        {timeline.loading ? (
          <div className="flex items-center gap-2 py-6">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND }} />
            <span className="text-[12.5px]" style={{ color: INK_3 }}>
              Reading this post&apos;s figures…
            </span>
          </div>
        ) : timeline.points.length === 0 ? (
          <EmptyNote>
            {timeline.problem ??
              'This post has no day-by-day figures yet. They usually appear within a day of publishing.'}
          </EmptyNote>
        ) : (
          <>
            <div className="grid gap-[8px] grid-cols-2 md:grid-cols-4">
              {timeline.metricKeys.slice(0, 8).map((key) => (
                <div
                  key={key}
                  className="rounded-[10px] px-[10px] py-[8px]"
                  style={{ border: `1px solid ${LINE}` }}
                >
                  <p className="text-[11px]" style={{ color: INK_3 }}>
                    {prettyMetric(key)}
                  </p>
                  <p
                    className="text-[17px] font-[600] tabular-nums"
                    style={{ color: BRAND_DEEP }}
                  >
                    {(timeline.totals[key] ?? 0).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {chartKey && points.length > 1 ? (
              <div>
                <p className="mb-[6px] text-[12px]" style={{ color: INK_3 }}>
                  {prettyMetric(chartKey)}, day by day since it went out
                </p>
                <ChartLine
                  labels={points.map((point) => point.date.slice(5))}
                  data={points.map((point) => point.value)}
                  colour={colour}
                  height={200}
                />
              </div>
            ) : (
              <EmptyNote>
                Only one reading has come back so far, so there is no curve to draw yet.
              </EmptyNote>
            )}

            {timeline.publishedAt ? (
              <p className="text-[11.5px]" style={{ color: INK_3 }}>
                Published {new Date(timeline.publishedAt).toLocaleString('en-AU')}.
              </p>
            ) : null}
          </>
        )}

        {timeline.problem && timeline.points.length > 0 ? (
          <p className="text-[11.5px]" style={{ color: INK_3 }}>
            {timeline.problem}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
