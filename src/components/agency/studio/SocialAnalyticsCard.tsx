'use client'

import { useState } from 'react'
import { useSocialAnalytics } from '@/hooks/useSocialAnalytics'
import { useAgencyStore } from '@/stores/agency-store'
import { BarChart3, TrendingUp, Loader2 } from 'lucide-react'

const PERIOD_OPTIONS = [
  { value: '7_days', label: '7d' },
  { value: '30_days', label: '30d' },
  { value: '90_days', label: '90d' },
] as const

/** oklch platform accent colours */
const PLATFORM_COLOURS: Record<string, string> = {
  Instagram: 'oklch(0.65 0.25 330)',
  Facebook: 'oklch(0.55 0.2 250)',
  LinkedIn: 'oklch(0.55 0.15 240)',
  TikTok: 'oklch(0.7 0.2 180)',
  YouTube: 'oklch(0.6 0.25 25)',
  X: 'oklch(0.5 0 0)',
}

/** Pick the most meaningful headline metric for each platform */
function headlineMetric(metrics: Record<string, number>): { label: string; value: number } | null {
  const priorities = ['impressions', 'reach', 'views', 'followers', 'engagement']
  for (const key of priorities) {
    if (metrics[key] != null) return { label: key, value: metrics[key] }
  }
  const first = Object.entries(metrics)[0]
  return first ? { label: first[0], value: first[1] } : null
}

/** Pick secondary metrics (up to 3, excluding the headline) */
function secondaryMetrics(
  metrics: Record<string, number>,
  excludeKey: string
): Array<{ label: string; value: number }> {
  return Object.entries(metrics)
    .filter(([k]) => k !== excludeKey)
    .slice(0, 3)
    .map(([label, value]) => ({ label, value }))
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function humanLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export function SocialAnalyticsCard() {
  const { activeBrandId } = useAgencyStore()
  const [period, setPeriod] = useState<string>('7_days')
  const { data, loading } = useSocialAnalytics(activeBrandId, period)

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Social Performance</h3>
        </div>

        {/* Period pills */}
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-colors ${
                period === opt.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading analytics...</span>
        </div>
      ) : !data?.configured || data.error ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground text-center">
            Connect Mixpost to see social analytics
          </p>
        </div>
      ) : Object.keys(data.platforms).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground text-center">
            No analytics data for this period yet
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data.platforms).map(([platform, info]) => {
            const headline = headlineMetric(info.metrics)
            const secondary = headline
              ? secondaryMetrics(info.metrics, headline.label)
              : []
            const accentColour = PLATFORM_COLOURS[platform] ?? 'oklch(0.6 0 0)'

            return (
              <div
                key={platform}
                className="rounded-xl border border-border bg-background p-3 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: accentColour }}
                  />
                  <span className="text-xs font-semibold text-foreground">{platform}</span>
                  {headline && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatNumber(headline.value)} {humanLabel(headline.label).toLowerCase()}
                    </span>
                  )}
                </div>

                {secondary.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {secondary.map(m => (
                      <span key={m.label} className="text-[11px] text-muted-foreground">
                        {humanLabel(m.label)}: <span className="font-medium text-foreground">{formatNumber(m.value)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
