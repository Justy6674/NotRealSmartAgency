'use client'

import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Platform Colours ─────────────────────────────────────────────────────────

const PLATFORM_BAR_COLOURS: Record<string, string> = {
  instagram: 'bg-pink-400',
  facebook: 'bg-blue-400',
  linkedin: 'bg-sky-400',
  twitter: 'bg-zinc-400',
  tiktok: 'bg-cyan-400',
  youtube: 'bg-red-400',
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  twitter: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AnalyticsSummaryCardProps {
  totalPosts: number
  platformBreakdown: Record<string, number>
  totalOutputs: number
  aiSpendCents: number
  period: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function AnalyticsSummaryCard({
  totalPosts,
  platformBreakdown,
  totalOutputs,
  aiSpendCents,
  period,
}: AnalyticsSummaryCardProps) {
  const maxCount = Math.max(...Object.values(platformBreakdown), 1)

  // Sort platforms by count descending
  const sortedPlatforms = Object.entries(platformBreakdown)
    .sort(([, a], [, b]) => b - a)

  const spendDollars = (aiSpendCents / 100).toFixed(2)

  return (
    <div className="rounded-xl border border-border bg-card p-4 my-2 max-w-md">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{period}</span>
      </div>

      {/* Posts total */}
      <p className="text-sm text-foreground mb-3">
        <span className="text-lg font-bold tabular-nums">{totalPosts}</span>
        <span className="text-muted-foreground ml-1.5">posts published</span>
      </p>

      {/* Platform breakdown bars */}
      {sortedPlatforms.length > 0 && (
        <div className="space-y-2 mb-4">
          {sortedPlatforms.map(([platform, count]) => {
            const pct = Math.round((count / maxCount) * 100)
            const barColour = PLATFORM_BAR_COLOURS[platform.toLowerCase()] ?? 'bg-muted-foreground'
            const label = PLATFORM_LABELS[platform.toLowerCase()] ?? platform

            return (
              <div key={platform} className="flex items-center gap-3">
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', barColour)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-28 text-right">
                  {label} ({count})
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom stats */}
      <div className="flex items-center gap-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground tabular-nums">{totalOutputs}</span> content pieces
        </span>
        <span>
          <span className="font-semibold text-foreground tabular-nums">${spendDollars}</span> AI spend
        </span>
      </div>
    </div>
  )
}
