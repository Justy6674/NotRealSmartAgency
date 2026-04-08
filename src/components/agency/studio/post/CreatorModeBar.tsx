'use client'

import { FileText, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CreatorMode = 'fresh' | 'template'

interface CreatorModeBarProps {
  mode: CreatorMode
  onModeChange: (mode: CreatorMode) => void
}

/**
 * "Use Template / Start Fresh" two-button toggle — adapted from
 * Scent Sell's "Search Database / Enter Manually" pattern.
 */
export function CreatorModeBar({ mode, onModeChange }: CreatorModeBarProps) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onModeChange('fresh')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
          mode === 'fresh'
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-card text-foreground/80 hover:border-primary/50'
        )}
      >
        <PenLine className="h-4 w-4" />
        Start Fresh
      </button>
      <button
        type="button"
        onClick={() => onModeChange('template')}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all',
          mode === 'template'
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-border bg-card text-foreground/80 hover:border-primary/50'
        )}
      >
        <FileText className="h-4 w-4" />
        Use Template
      </button>
    </div>
  )
}
