'use client'

import { CalendarDays, Save, Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostPlatform } from '@/types/database'

interface ComposerActionBarProps {
  platforms: PostPlatform[]
  scheduledAt: string
  onScheduleChange: (value: string) => void
  onSaveDraft: () => void
  onSchedule: () => void
  saving: boolean
  isDirty: boolean
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📱',
  facebook: '📘',
  linkedin: '💼',
  twitter: '𝕏',
  tiktok: '🎵',
  youtube: '▶️',
}

export function ComposerActionBar({
  platforms,
  scheduledAt,
  onScheduleChange,
  onSaveDraft,
  onSchedule,
  saving,
  isDirty,
}: ComposerActionBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      {/* Left — platforms + schedule */}
      <div className="flex items-center gap-3">
        {/* Platform pills */}
        <div className="flex items-center gap-1">
          {platforms.map(p => (
            <span key={p} className="text-sm" title={p}>
              {PLATFORM_ICONS[p] ?? '📌'}
            </span>
          ))}
        </div>

        {/* Schedule picker */}
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => onScheduleChange(e.target.value)}
            className={cn(
              'rounded-md border bg-background px-2.5 py-1.5 text-xs',
              'focus:outline-none focus:ring-2 focus:ring-primary',
            )}
          />
        </div>
      </div>

      {/* Right — action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={saving || !isDirty}
          onClick={onSaveDraft}
          className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          Save Draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onSchedule}
          className="flex items-center gap-1.5 rounded-md bg-[oklch(0.55_0.1_240)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Schedule
        </button>
      </div>
    </div>
  )
}
