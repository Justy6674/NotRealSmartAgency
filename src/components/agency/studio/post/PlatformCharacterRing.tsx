'use client'

import { PLATFORM_BRAND_COLOURS, PLATFORM_LABELS, type PlatformKey } from '@/lib/mixpost/ui-tokens'

interface PlatformCharacterRingProps {
  platform: PlatformKey
  used: number
  limit: number
  /** 'ok' | 'warning' | 'over' from usePostCharacterLimit */
  state: 'ok' | 'warning' | 'over'
  /** Ring diameter in px (default 36) */
  size?: number
}

/**
 * Circular progress ring that shows remaining characters for one
 * platform inside the composer. Matches Mixpost's inline per-platform
 * character indicator but uses SVG circles + NRS oklch tokens.
 *
 * Phase 3 of the Mixpost UI port. Rendered as part of
 * PostContentValidator alongside one ring per selected platform.
 *
 * State-based colour:
 *   ok      -> platform brand colour (solid progress)
 *   warning -> orange/amber (oklch warning tone)
 *   over    -> red (oklch destructive tone)
 */
export function PlatformCharacterRing({
  platform,
  used,
  limit,
  state,
  size = 36,
}: PlatformCharacterRingProps) {
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const percent = Math.min((used / limit) * 100, 100)
  const dash = (percent / 100) * circumference

  const colour =
    state === 'over'
      ? 'oklch(0.55 0.2 25)'   // destructive red
      : state === 'warning'
        ? 'oklch(0.65 0.15 75)' // warning orange
        : PLATFORM_BRAND_COLOURS[platform]

  const remaining = limit - used
  const label = PLATFORM_LABELS[platform]

  return (
    <div className="inline-flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        role="img"
        aria-label={`${label}: ${used} of ${limit} characters used`}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="oklch(0.92 0.00 0)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 200ms ease-out, stroke 150ms ease' }}
        />
      </svg>
      <div className="flex flex-col leading-tight">
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: state === 'over' ? 'oklch(0.55 0.2 25)' : colour }}
        >
          {label}
        </span>
        <span
          className={`text-[10px] tabular-nums ${
            state === 'over'
              ? 'text-[oklch(0.55_0.2_25)] font-semibold'
              : state === 'warning'
                ? 'text-[oklch(0.55_0.15_75)]'
                : 'text-muted-foreground'
          }`}
        >
          {remaining < 0 ? `${remaining}` : `${remaining} left`}
        </span>
      </div>
    </div>
  )
}
