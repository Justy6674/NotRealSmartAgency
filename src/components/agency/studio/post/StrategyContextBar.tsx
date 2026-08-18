'use client'

import { TrendingUp, Target, Calendar, AlertTriangle, Sparkles } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'

interface StrategyContextBarProps {
  brandName: string
  postsThisWeek: number
  postsTarget: number
  suggestedPlatform: string | null
  suggestedPillar: string | null
  suggestedContentType: string | null
  suggestion: string
  isHealthBrand: boolean
}

/**
 * Strategy intelligence strip — same paper family as Compose cards.
 */
export function StrategyContextBar({
  brandName,
  postsThisWeek,
  postsTarget,
  suggestedPlatform,
  suggestedPillar,
  suggestedContentType,
  suggestion,
  isHealthBrand,
}: StrategyContextBarProps) {
  const gap = postsTarget - postsThisWeek
  const onTrack = gap <= 0
  const progressPercent = postsTarget > 0 ? Math.min((postsThisWeek / postsTarget) * 100, 100) : 0

  const pillStyle = {
    borderColor: 'var(--line, oklch(0.915 0.007 240))',
    background: 'var(--panel-2, oklch(0.975 0.004 240))',
    color: 'var(--ink-2, oklch(0.46 0.012 240))',
  }

  return (
    <div
      className="space-y-3 rounded-xl border p-4"
      style={{
        borderColor: 'var(--line, oklch(0.915 0.007 240))',
        background: 'var(--panel, oklch(1 0 0))',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" style={{ color: 'var(--brand-deep, oklch(0.33 0.08 240))' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
            This week — {brandName}
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            sendToDirector(
              `What should ${brandName} focus on this week? Review our strategy, content gaps, and give me a prioritised action plan.`,
            )
          }
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colours"
          style={{
            background: 'var(--brand-wash, oklch(0.965 0.018 240))',
            color: 'var(--brand-deep, oklch(0.33 0.08 240))',
          }}
        >
          <Sparkles className="h-3 w-3" />
          Full briefing
        </button>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
            {postsThisWeek} of {postsTarget} posts this week
          </span>
          <span
            className="font-medium"
            style={{
              color: onTrack
                ? 'oklch(0.55 0.12 145)'
                : gap <= 1
                  ? 'oklch(0.62 0.14 70)'
                  : 'var(--care, oklch(0.52 0.15 25))',
            }}
          >
            {onTrack ? 'On track' : `${gap} more needed`}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: 'var(--panel-2, oklch(0.975 0.004 240))' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
              background: onTrack
                ? 'oklch(0.55 0.12 145)'
                : gap <= 1
                  ? 'oklch(0.62 0.14 70)'
                  : 'var(--care, oklch(0.52 0.15 25))',
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestedPlatform && (
          <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]" style={pillStyle}>
            <Target className="h-3 w-3" />
            Focus: {suggestedPlatform}
          </div>
        )}
        {suggestedPillar && (
          <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]" style={pillStyle}>
            <Calendar className="h-3 w-3" />
            Pillar: {suggestedPillar}
          </div>
        )}
        {suggestedContentType && (
          <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]" style={pillStyle}>
            Type: {suggestedContentType}
          </div>
        )}
        {isHealthBrand && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]"
            style={{
              borderColor: 'var(--care-line, oklch(0.89 0.05 25))',
              background: 'var(--care-wash, oklch(0.965 0.028 25))',
              color: 'var(--care, oklch(0.52 0.15 25))',
            }}
          >
            <AlertTriangle className="h-3 w-3" />
            AHPRA/TGA
          </div>
        )}
      </div>

      {suggestion && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
          {suggestion}
        </p>
      )}
    </div>
  )
}
