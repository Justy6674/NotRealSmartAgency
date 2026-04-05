'use client'

import { Target } from 'lucide-react'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface StrategyBriefProps {
  context: StrategyContext | null
}

export function StrategyBrief({ context }: StrategyBriefProps) {
  if (!context) return null

  const { postsThisWeek, postsTarget, suggestion } = context
  const onTrack = postsThisWeek >= postsTarget

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
      <Target className={`h-4 w-4 shrink-0 ${onTrack ? 'text-emerald-400' : 'text-amber-400'}`} />
      <p className="text-xs text-foreground/80 flex-1">{suggestion}</p>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {postsThisWeek}/{postsTarget} this week
      </span>
    </div>
  )
}
