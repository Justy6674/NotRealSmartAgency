'use client'

import { TrendingUp, Target, Calendar, AlertTriangle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
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
 * Shows the Director's strategy intelligence at the top of the Create room.
 * Driven by useStrategyContext — no additional API calls needed.
 * Tells the user what their strategy says they need this week.
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

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">This Week — {brandName}</span>
        </div>
        <button
          type="button"
          onClick={() => sendToDirector(`What should ${brandName} focus on this week? Review our strategy, content gaps, and give me a prioritised action plan.`)}
          className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          Full briefing
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {postsThisWeek} of {postsTarget} posts this week
          </span>
          <span className={cn(
            'font-medium',
            onTrack ? 'text-emerald-500' : gap <= 1 ? 'text-amber-500' : 'text-red-500'
          )}>
            {onTrack ? 'On track' : `${gap} more needed`}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              onTrack ? 'bg-emerald-500' : gap <= 1 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Strategy pills */}
      <div className="flex flex-wrap gap-2">
        {suggestedPlatform && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/8 border border-blue-500/15 px-2.5 py-1 text-[11px] text-blue-600 dark:text-blue-400">
            <Target className="h-3 w-3" />
            Focus: {suggestedPlatform}
          </div>
        )}
        {suggestedPillar && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/8 border border-purple-500/15 px-2.5 py-1 text-[11px] text-purple-600 dark:text-purple-400">
            <Calendar className="h-3 w-3" />
            Pillar: {suggestedPillar}
          </div>
        )}
        {suggestedContentType && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            Type: {suggestedContentType}
          </div>
        )}
        {isHealthBrand && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-red-500/8 border border-red-500/15 px-2.5 py-1 text-[11px] text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            AHPRA/TGA
          </div>
        )}
      </div>

      {/* Director suggestion */}
      {suggestion && (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {suggestion}
        </p>
      )}
    </div>
  )
}
