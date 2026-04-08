'use client'

import { useState } from 'react'
import { Calendar, Clock, Zap, Save, Loader2 } from 'lucide-react'
import type { PostPlatform } from '@/types/database'

type PublishMode = 'draft' | 'schedule' | 'now'

// Best posting times (AEST) from platform algorithm knowledge
const BEST_TIMES: Record<string, string> = {
  instagram: '7:00 AM or 6:00 PM AEST',
  facebook: '1:00 PM or 7:00 PM AEST',
  linkedin: '8:00 AM or 12:00 PM AEST',
  twitter: '9:00 AM or 5:00 PM AEST',
  tiktok: '7:00 PM or 9:00 PM AEST',
  youtube: '2:00 PM or 5:00 PM AEST',
}

interface PostSchedulerProps {
  selectedPlatforms: PostPlatform[]
  onSave: (mode: PublishMode, scheduledAt: string | null) => Promise<void>
  disabled?: boolean
}

function getDefaultScheduleTime(): string {
  // Default to tomorrow at 9:00 AM AEST
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  // Format as datetime-local value
  const year = tomorrow.getFullYear()
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0')
  const day = String(tomorrow.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}T09:00`
}

export function PostScheduler({ selectedPlatforms, onSave, disabled = false }: PostSchedulerProps) {
  const [mode, setMode] = useState<PublishMode>('schedule')
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduleTime)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(mode, mode === 'schedule' ? scheduledAt : null)
    } finally {
      setSaving(false)
    }
  }

  const modes: { value: PublishMode; label: string; icon: typeof Calendar; description: string }[] = [
    { value: 'draft', label: 'Save Draft', icon: Save, description: 'Save for later editing' },
    { value: 'schedule', label: 'Schedule', icon: Calendar, description: 'Pick a date and time' },
    { value: 'now', label: 'Publish Now', icon: Zap, description: 'Send to Director for review + publish' },
  ]

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-2">
        {modes.map(m => {
          const Icon = m.icon
          const active = mode === m.value
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              disabled={disabled}
              className={`flex flex-col items-center gap-1.5 rounded-lg px-3 py-3 text-center transition-all ${
                active
                  ? 'bg-primary text-primary-foreground ring-1 ring-primary'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{m.label}</span>
            </button>
          )
        })}
      </div>

      {/* Schedule date/time picker */}
      {mode === 'schedule' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Date & Time (AEST)
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              disabled={disabled}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-[family-name:var(--font-ibm-plex-mono)]"
            />
          </div>

          {/* Best time suggestions */}
          {selectedPlatforms.length > 0 && (
            <div className="rounded-md bg-[oklch(0.16_0.01_240)] px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3 w-3 text-[oklch(0.65_0.08_240)]" />
                <span className="text-[10px] font-medium text-[oklch(0.65_0.08_240)] uppercase tracking-wider">
                  Best times
                </span>
              </div>
              <div className="space-y-0.5">
                {selectedPlatforms.map(p => (
                  <p key={p} className="text-[11px] text-muted-foreground">
                    <span className="text-foreground/70 font-medium">{p.charAt(0).toUpperCase() + p.slice(1)}:</span>{' '}
                    {BEST_TIMES[p] ?? 'No data'}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={disabled || saving || selectedPlatforms.length === 0}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            {mode === 'draft' && <Save className="h-4 w-4" />}
            {mode === 'schedule' && <Calendar className="h-4 w-4" />}
            {mode === 'now' && <Zap className="h-4 w-4" />}
            {mode === 'draft' ? 'Save Draft' : mode === 'schedule' ? 'Schedule Post' : 'Send to Director'}
          </>
        )}
      </button>

      {selectedPlatforms.length === 0 && (
        <p className="text-[11px] text-amber-400/80 text-center">
          Select at least one platform above
        </p>
      )}
    </div>
  )
}
