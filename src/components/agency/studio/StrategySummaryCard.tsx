'use client'

import { ArrowRight } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  '3x_week': '3x / week',
  '2x_week': '2x / week',
  weekly: 'Weekly',
  custom: 'Custom',
}

const GROWTH_LABELS: Record<string, string> = {
  organic: 'Organic',
  paid: 'Paid',
  hybrid: 'Hybrid',
  community: 'Community',
}

interface StrategySummaryCardProps {
  brand: Brand
}

export function StrategySummaryCard({ brand }: StrategySummaryCardProps) {
  const strategy = brand.channel_strategy as Record<string, unknown> | null
  const channels = strategy?.channels as Record<string, number> | null
  const frequency = strategy?.posting_frequency as string | null
  const growth = strategy?.growth_approach as string | null
  const pillars = brand.content_pillars as string[] | null

  const hasStrategy = channels && Object.keys(channels).length > 0
  const hasPillars = pillars && pillars.length > 0

  const handleRefine = () => {
    sendToDirector(`Let's review and update the marketing strategy for ${brand.name}`)
  }

  const handleBuild = () => {
    sendToDirector(`Help me build a content strategy for ${brand.name}`)
  }

  if (!hasStrategy && !hasPillars) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Strategy</h3>
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground mb-2">No strategy defined yet.</p>
          <button
            onClick={handleBuild}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 mx-auto"
          >
            Build strategy
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Strategy</h3>
        <button
          onClick={handleRefine}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Refine
        </button>
      </div>

      {/* Content pillars */}
      {hasPillars && (
        <div className="flex flex-wrap gap-1.5">
          {pillars!.slice(0, 6).map((pillar, i) => (
            <span
              key={i}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary"
            >
              {pillar}
            </span>
          ))}
        </div>
      )}

      {/* Frequency + growth */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {frequency && (
          <span>{FREQUENCY_LABELS[frequency] ?? frequency}</span>
        )}
        {frequency && growth && <span>·</span>}
        {growth && (
          <span>{GROWTH_LABELS[growth] ?? growth}</span>
        )}
      </div>

      {/* Channel allocation bar */}
      {hasStrategy && (
        <div className="space-y-1.5">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {Object.entries(channels!).map(([platform, pct]) => {
              const colours: Record<string, string> = {
                instagram: 'bg-pink-400',
                facebook: 'bg-blue-400',
                linkedin: 'bg-sky-400',
                tiktok: 'bg-cyan-400',
                youtube: 'bg-red-400',
                twitter: 'bg-zinc-400',
                x: 'bg-zinc-400',
              }
              return (
                <div
                  key={platform}
                  className={colours[platform.toLowerCase()] ?? 'bg-zinc-500'}
                  style={{ width: `${pct}%` }}
                  title={`${platform}: ${pct}%`}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {Object.entries(channels!).map(([platform, pct]) => (
              <span key={platform} className="text-[10px] text-muted-foreground">
                {platform} {pct}%
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
