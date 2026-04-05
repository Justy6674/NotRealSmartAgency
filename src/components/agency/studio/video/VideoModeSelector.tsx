'use client'

import { Sparkles, Film, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VideoMode = 'create' | 'edit' | 'import'

interface VideoModeSelectorProps {
  mode: VideoMode
  onModeChange: (mode: VideoMode) => void
}

const MODES = [
  {
    id: 'create' as const,
    icon: Sparkles,
    label: 'Create',
    description: 'AI generates your video',
  },
  {
    id: 'edit' as const,
    icon: Film,
    label: 'Edit',
    description: 'Import and edit manually',
  },
  {
    id: 'import' as const,
    icon: Upload,
    label: 'Import',
    description: 'Bulk upload and process',
  },
]

export function VideoModeSelector({ mode, onModeChange }: VideoModeSelectorProps) {
  return (
    <div className="flex gap-2">
      {MODES.map(m => {
        const Icon = m.icon
        const active = mode === m.id
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onModeChange(m.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all',
              active
                ? 'border-[oklch(0.55_0.1_240)]/50 bg-[oklch(0.55_0.1_240)]/10 text-[oklch(0.75_0.06_240)]'
                : 'border-border bg-card text-muted-foreground hover:border-[oklch(0.55_0.1_240)]/30 hover:text-foreground'
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
