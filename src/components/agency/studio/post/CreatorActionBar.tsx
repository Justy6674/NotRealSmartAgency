'use client'

import { useState } from 'react'
import { Save, Calendar, Zap, Loader2, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostPlatform } from '@/types/database'

// Platform colour dots
const PLATFORM_COLOURS: Record<PostPlatform, string> = {
  instagram: 'bg-pink-400',
  facebook: 'bg-blue-400',
  tiktok: 'bg-cyan-400',
  youtube: 'bg-red-400',
  linkedin: 'bg-sky-400',
  twitter: 'bg-zinc-400',
}

interface CreatorActionBarProps {
  platforms: PostPlatform[]
  captionEmpty: boolean
  compliancePassed: boolean | null
  saving: boolean
  onSave: (mode: 'draft' | 'schedule' | 'now', scheduledAt?: string) => void
}

/**
 * Scent Sell-style sticky bottom action bar with blur.
 * Save Draft / Schedule / Publish Now — with compliance gate.
 */
export function CreatorActionBar({
  platforms,
  captionEmpty,
  compliancePassed,
  saving,
  onSave,
}: CreatorActionBarProps) {
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledAt, setScheduledAt] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    return tomorrow.toISOString().slice(0, 16)
  })

  const noPlatforms = platforms.length === 0
  const disabled = saving || captionEmpty

  return (
    <div className="space-y-2">
      {/* Schedule datetime picker (expands inline) */}
      {showSchedule && (
        <div className="flex items-center gap-2 pb-1">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={e => setScheduledAt(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
          />
        </div>
      )}

      {/* Main bar */}
      <div className="flex items-center gap-3">
        {/* Left: platform dots + compliance */}
        <div className="flex items-center gap-2 shrink-0">
          {platforms.length > 0 && (
            <div className="flex items-center gap-1">
              {platforms.map(p => (
                <span key={p} className={cn('h-2 w-2 rounded-full', PLATFORM_COLOURS[p])} title={p} />
              ))}
            </div>
          )}
          {compliancePassed === true && (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          )}
          {compliancePassed === false && (
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
          )}
        </div>

        {/* Right: action buttons */}
        <div className="flex gap-2 flex-1 justify-end">
          {/* Save Draft */}
          <button
            type="button"
            onClick={() => onSave('draft')}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colours disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </button>

          {/* Schedule */}
          <button
            type="button"
            onClick={() => {
              if (showSchedule) {
                onSave('schedule', scheduledAt)
                setShowSchedule(false)
              } else {
                setShowSchedule(true)
              }
            }}
            disabled={disabled || noPlatforms}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colours disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
            {showSchedule ? 'Confirm Schedule' : 'Schedule'}
          </button>

          {/* Publish Now */}
          <button
            type="button"
            onClick={() => onSave('now')}
            disabled={disabled || noPlatforms || compliancePassed === false}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colours disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Publish Now
          </button>
        </div>
      </div>

      {/* Helper text */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Save Draft keeps it private. Schedule queues it. Publish sends immediately via Mixpost.
        </p>
        {compliancePassed === false && (
          <span className="text-[10px] text-red-400 font-medium">Fix compliance issues first</span>
        )}
      </div>
    </div>
  )
}
