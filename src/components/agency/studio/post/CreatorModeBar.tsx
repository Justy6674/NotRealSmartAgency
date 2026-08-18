'use client'

import { FileText, PenLine } from 'lucide-react'

export type CreatorMode = 'fresh' | 'template'

interface CreatorModeBarProps {
  mode: CreatorMode
  onModeChange: (mode: CreatorMode) => void
}

/** Start fresh / use template — copper selected state on paper cards. */
export function CreatorModeBar({ mode, onModeChange }: CreatorModeBarProps) {
  const base =
    'flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all'

  const selectedStyle = {
    borderColor: 'var(--brand-deep, oklch(0.33 0.08 240))',
    background: 'var(--brand-wash, oklch(0.965 0.018 240))',
    color: 'var(--brand-deep, oklch(0.33 0.08 240))',
  }

  const idleStyle = {
    borderColor: 'var(--line, oklch(0.915 0.007 240))',
    background: 'var(--panel, oklch(1 0 0))',
    color: 'var(--ink-2, oklch(0.46 0.012 240))',
  }

  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onModeChange('fresh')}
        className={base}
        style={mode === 'fresh' ? selectedStyle : idleStyle}
      >
        <PenLine className="h-4 w-4" />
        Start fresh
      </button>
      <button
        type="button"
        onClick={() => onModeChange('template')}
        className={base}
        style={mode === 'template' ? selectedStyle : idleStyle}
      >
        <FileText className="h-4 w-4" />
        Use template
      </button>
    </div>
  )
}
