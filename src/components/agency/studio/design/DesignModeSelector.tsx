'use client'

import { Sparkles, LayoutGrid, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DesignMode = 'create' | 'browse' | 'upload'

interface DesignModeSelectorProps {
  mode: DesignMode
  onModeChange: (mode: DesignMode) => void
}

const MODES = [
  {
    id: 'create' as const,
    icon: Sparkles,
    label: 'Create',
    description: 'AI designs it for you',
  },
  {
    id: 'browse' as const,
    icon: LayoutGrid,
    label: 'Browse',
    description: 'Your Canva designs',
  },
  {
    id: 'upload' as const,
    icon: Upload,
    label: 'Upload',
    description: 'Your own images',
  },
]

export function DesignModeSelector({ mode, onModeChange }: DesignModeSelectorProps) {
  return (
    <div className="flex gap-2">
      {MODES.map(m => {
        const Icon = m.icon
        const active = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all',
              active
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium">{m.label}</div>
              <div className="text-[10px] opacity-70">{m.description}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
