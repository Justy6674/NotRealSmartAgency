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
 * Typography spec from DESIGN.md / dept-social.html:
 * - stat value: 27px, weight 700, color var(--brand-deep)
 * - label: 11px, uppercase, letter-spacing 0.05em, color ink-3
 * - delta: 11px, oklch semantic colour (--ok / --warn)
 */
export function MetricCard({
  label,
  value,
  delta,
  sparkline,
  icon,
  compact = false,
}: MetricCardProps) {
  const deltaIsUp   = typeof delta === 'number' && delta > 0
  const deltaIsDown = typeof delta === 'number' && delta < 0

  // DESIGN.md semantic colours: --ok (green), --warn (amber)
  const deltaColour = delta === undefined
    ? 'oklch(0.615 0.011 240)'
    : deltaIsUp
      ? 'var(--ok, oklch(0.56 0.15 145))'
      : deltaIsDown
        ? 'var(--warn, oklch(0.65 0.18 25))'
        : 'oklch(0.615 0.011 240)'

  const sparklineColour = deltaIsUp
    ? 'var(--ok, oklch(0.56 0.15 145))'
    : deltaIsDown
      ? 'var(--warn, oklch(0.65 0.18 25))'
      : 'oklch(0.55 0.05 240)'

  return (
    <Card size={compact ? 'sm' : 'default'}>
      <CardContent className="flex flex-col gap-[10px]">
        {/* Label row */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="flex items-center gap-[5px] font-[500] uppercase tracking-[0.05em]"
            style={{
              fontSize: '11px',
              color: 'oklch(0.615 0.011 240)',
            }}
          >
            {icon}
            {label}
          </span>
          {sparkline && sparkline.length > 1 && (
            <Sparkline points={sparkline} colour={sparklineColour} />
          )}
        </div>

        {/* Value + delta row */}
        <div className="flex items-end justify-between gap-2">
          {/* 27 px brand-deep stat value — DESIGN.md §Statistics */}
          <span
            className={cn('tabular-nums', compact ? 'text-[22px]' : 'text-[27px]')}
            style={{
              fontWeight: 700,
              color: 'var(--brand-deep, oklch(0.33 0.08 240))',
              fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
            }}
          >
            {formatValue(value)}
          </span>

          {delta !== undefined && (
            <span
              className={cn(
                'flex items-center gap-[3px] text-[11px] font-[500] tabular-nums',
              )}
              style={{ color: deltaColour }}
            >
              {deltaIsUp ? (
                <TrendingUp className="h-[12px] w-[12px]" />
              ) : deltaIsDown ? (
                <TrendingDown className="h-[12px] w-[12px]" />
              ) : (
                <Minus className="h-[12px] w-[12px]" />
              )}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
