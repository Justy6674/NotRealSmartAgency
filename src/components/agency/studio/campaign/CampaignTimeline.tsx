'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { CampaignDuration } from './CampaignBrief'

export interface TimelinePhase {
  name: string
  startWeek: number
  endWeek: number
  colour: string
}

export interface TimelineItem {
  id: string
  label: string
  week: number
  department: string
  status: 'pending' | 'generating' | 'complete'
}

interface CampaignTimelineProps {
  duration: CampaignDuration
  items: TimelineItem[]
  campaignName: string
}

const DURATION_WEEKS: Record<CampaignDuration, number> = {
  '1_week': 1,
  '2_weeks': 2,
  '1_month': 4,
  '3_months': 12,
}

function buildPhases(totalWeeks: number): TimelinePhase[] {
  if (totalWeeks <= 1) {
    return [
      { name: 'Prep + Launch', startWeek: 1, endWeek: 1, colour: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    ]
  }
  if (totalWeeks <= 2) {
    return [
      { name: 'Preparation', startWeek: 1, endWeek: 1, colour: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      { name: 'Launch', startWeek: 2, endWeek: 2, colour: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    ]
  }
  const prep = Math.max(1, Math.floor(totalWeeks * 0.25))
  const launch = Math.max(1, Math.floor(totalWeeks * 0.25))
  const sustain = Math.max(1, totalWeeks - prep - launch - 1)
  const review = 1

  return [
    { name: 'Preparation', startWeek: 1, endWeek: prep, colour: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { name: 'Launch', startWeek: prep + 1, endWeek: prep + launch, colour: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { name: 'Sustain', startWeek: prep + launch + 1, endWeek: prep + launch + sustain, colour: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { name: 'Review', startWeek: totalWeeks, endWeek: totalWeeks, colour: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  ]
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-zinc-500',
  generating: 'bg-amber-400 animate-pulse',
  complete: 'bg-emerald-400',
}

export function CampaignTimeline({ duration, items, campaignName }: CampaignTimelineProps) {
  const totalWeeks = DURATION_WEEKS[duration]
  const phases = useMemo(() => buildPhases(totalWeeks), [totalWeeks])
  const weekNumbers = useMemo(() => Array.from({ length: totalWeeks }, (_, i) => i + 1), [totalWeeks])

  // Suppress unused variable warning — review is used semantically in buildPhases
  void 0

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{campaignName} Timeline</h3>
        <span className="text-xs text-muted-foreground">
          {totalWeeks} week{totalWeeks > 1 ? 's' : ''}
        </span>
      </div>

      {/* Phase bar */}
      <div className="flex gap-1 rounded-lg overflow-hidden">
        {phases.map(phase => {
          const span = phase.endWeek - phase.startWeek + 1
          const widthPct = (span / totalWeeks) * 100
          return (
            <div
              key={phase.name}
              className={cn('px-3 py-1.5 text-[11px] font-medium border rounded', phase.colour)}
              style={{ width: `${widthPct}%`, minWidth: 'fit-content' }}
            >
              {phase.name}
            </div>
          )
        })}
      </div>

      {/* Week columns grid */}
      <div className="overflow-x-auto">
        <div
          className="grid gap-px min-w-fit"
          style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(100px, 1fr))` }}
        >
          {/* Week headers */}
          {weekNumbers.map(w => (
            <div key={`h-${w}`} className="px-2 py-1 text-[10px] font-medium text-muted-foreground text-center border-b border-border">
              Week {w}
            </div>
          ))}

          {/* Content items per week */}
          {weekNumbers.map(w => {
            const weekItems = items.filter(item => item.week === w)
            return (
              <div key={`c-${w}`} className="px-1.5 py-2 space-y-1.5 min-h-[60px]">
                {weekItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1"
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT[item.status])} />
                    <span className="text-[10px] text-foreground truncate">{item.label}</span>
                  </div>
                ))}
                {weekItems.length === 0 && (
                  <div className="text-[10px] text-muted-foreground/40 text-center italic">--</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
