'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface MetricCardProps {
  label: string
  /** Display value — pre-formatted (e.g. "12.5k", "84%") or raw number. */
  value: number | string
  /** Period-over-period delta as a percentage (e.g. +12.4 for +12.4%). */
  delta?: number
  /** Tiny inline trend line — array of points (0..N normalised). */
  sparkline?: number[]
  /** Optional icon shown next to the label. */
  icon?: React.ReactNode
  /** Compact variant for dashboard widget rows. */
  compact?: boolean
}

function formatValue(value: number | string): string {
  if (typeof value === 'string') return value
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(Math.round(value))
}

function Sparkline({ points, colour }: { points: number[]; colour: string }) {
  if (points.length < 2) return null
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const width = 64
  const height = 20
  const step = width / (points.length - 1)
  const path = points
    .map((p, i) => {
      const x = i * step
      const y = height - ((p - min) / range) * height
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="opacity-80"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={colour}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Big-number metric card with optional delta + sparkline.
 *
 * Used by:
 * - StudioDashboard widget row (compact variant)
 * - All 10 platform analytics report pages (default variant)
 * - AnalyticsOverview cross-platform summary
 */
export function MetricCard({
  label,
  value,
  delta,
  sparkline,
  icon,
  compact = false,
}: MetricCardProps) {
  const deltaIsUp = typeof delta === 'number' && delta > 0
  const deltaIsDown = typeof delta === 'number' && delta < 0
  const deltaColour =
    delta === undefined
      ? 'text-muted-foreground'
      : deltaIsUp
        ? 'text-emerald-500'
        : deltaIsDown
          ? 'text-rose-500'
          : 'text-muted-foreground'

  const sparklineColour = deltaIsUp
    ? 'oklch(0.65 0.18 145)'
    : deltaIsDown
      ? 'oklch(0.65 0.20 25)'
      : 'oklch(0.55 0.05 240)'

  return (
    <Card size={compact ? 'sm' : 'default'}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {icon}
            {label}
          </span>
          {sparkline && sparkline.length > 1 && (
            <Sparkline points={sparkline} colour={sparklineColour} />
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <span
            className={cn(
              'font-semibold tabular-nums text-foreground',
              compact ? 'text-2xl' : 'text-3xl'
            )}
          >
            {formatValue(value)}
          </span>
          {delta !== undefined && (
            <span
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium tabular-nums',
                deltaColour
              )}
            >
              {deltaIsUp ? (
                <TrendingUp className="h-3 w-3" />
              ) : deltaIsDown ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
