'use client'

import { Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartLine } from './ChartLine'
import { EmptyNote } from './BestTimeCard'
import { useNativeInsights, type AnalyticsPeriod } from './analytics-desk'

/**
 * The figures a channel keeps about itself, rather than about its posts.
 *
 * Page views, accounts engaged, subscribers gained and lost, calls and
 * direction requests off a business listing — none of which come from adding up
 * post metrics, and none of which appeared anywhere on this desk before.
 *
 * ── A metric with no data is named, not zeroed ─────────────────────────
 * The channel tells us which metrics it refused or had nothing for, and those
 * are listed as unavailable rather than drawn as a zero. "Nobody called you" and
 * "the phone number is not being counted" are different sentences, and only one
 * of them is worth acting on.
 */

const LINE = 'var(--line, oklch(0.915 0.007 240))'
const INK_3 = 'oklch(0.615 0.011 240)'
const BRAND = 'var(--brand, oklch(0.545 0.03 240))'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'

export interface NativeInsightsCardProps {
  brandId: string
  accountId: string | null
  platform: string | null
  period: AnalyticsPeriod
  colour?: string
  /** The channel's name, for the copy. Never a vendor's name. */
  channelLabel?: string
}

export function NativeInsightsCard({
  brandId,
  accountId,
  platform,
  period,
  colour = 'oklch(0.545 0.03 240)',
  channelLabel,
}: NativeInsightsCardProps) {
  const insights = useNativeInsights({ brandId, accountId, platform, period })

  if (!accountId || !platform) return null

  const drawable = insights.metrics.find((metric) => metric.points.length > 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13.5px] font-[600]" style={{ color: BRAND_DEEP }}>
          {channelLabel ? `What ${channelLabel} reports about the account` : 'About the account'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-[12px]">
        {insights.loading ? (
          <div className="flex items-center gap-2 py-6">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: BRAND }} />
            <span className="text-[12.5px]" style={{ color: INK_3 }}>
              Reading the account&apos;s own figures…
            </span>
          </div>
        ) : insights.metrics.length === 0 ? (
          <EmptyNote>
            {insights.problem ??
              'This channel has not sent any of its own figures for this period yet.'}
          </EmptyNote>
        ) : (
          <>
            <div className="grid gap-[8px] grid-cols-2 md:grid-cols-4">
              {insights.metrics.slice(0, 8).map((metric) => (
                <div
                  key={metric.key}
                  className="rounded-[10px] px-[10px] py-[8px]"
                  style={{ border: `1px solid ${LINE}` }}
                >
                  <p className="text-[11px]" style={{ color: INK_3 }}>
                    {metric.label}
                  </p>
                  <p className="text-[17px] font-[600] tabular-nums" style={{ color: BRAND_DEEP }}>
                    {metric.total === null ? '—' : metric.total.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {drawable ? (
              <div>
                <p className="mb-[6px] text-[12px]" style={{ color: INK_3 }}>
                  {drawable.label}, day by day
                </p>
                <ChartLine
                  labels={drawable.points.map((point) => point.date.slice(5))}
                  data={drawable.points.map((point) => point.value)}
                  colour={colour}
                  height={200}
                />
              </div>
            ) : (
              <EmptyNote>
                This channel reports these as period totals only, so there is no day-by-day line to
                draw. The figures above are still real.
              </EmptyNote>
            )}
          </>
        )}

        {insights.unavailable.length > 0 ? (
          <p className="text-[11.5px]" style={{ color: INK_3 }}>
            Not reported for this period, so left out rather than shown as zero:{' '}
            {insights.unavailable.join(', ')}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
