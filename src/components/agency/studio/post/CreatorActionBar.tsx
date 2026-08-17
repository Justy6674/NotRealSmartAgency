'use client'

import { useState } from 'react'
import { Save, Loader2, Check, AlertTriangle, Clock, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostPlatform } from '@/types/database'

const PLATFORM_COLOURS: Record<PostPlatform, string> = {
  instagram: 'bg-pink-400',
  facebook: 'bg-blue-400',
  tiktok: 'bg-cyan-400',
  youtube: 'bg-red-400',
  linkedin: 'bg-sky-400',
  twitter: 'bg-zinc-400',
  bluesky: 'bg-blue-300',
  mastodon: 'bg-purple-400',
  pinterest: 'bg-red-500',
  threads: 'bg-zinc-300',
  google_business: 'bg-blue-400',
}

interface CreatorActionBarProps {
  platforms: PostPlatform[]
  captionEmpty: boolean
  compliancePassed: boolean | null
  saving: boolean
  onSave: (mode: 'draft' | 'schedule' | 'now', scheduledAt?: string) => void
  editMode?: boolean
  /** Next time on this business's posting plan, or null if none is set. */
  nextSlotIso?: string | null
}

function slotLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'next free slot'
  return date.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Sticky action bar. Every primary action is a button she clicks — Post now,
 * pick a time, next free slot, Save draft. The Director may have filled the
 * caption; these buttons still work with the rail collapsed.
 */
export function CreatorActionBar({
  platforms,
  captionEmpty,
  compliancePassed,
  saving,
  onSave,
  editMode,
  nextSlotIso,
}: CreatorActionBarProps) {
  const [pickingTime, setPickingTime] = useState(false)
  const [when, setWhen] = useState(() => toLocalInputValue(new Date().toISOString()))
  const disabled = saving || captionEmpty
  const blockedByHealth = compliancePassed === false

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 shrink-0">
          {platforms.length > 0 && (
            <div className="flex items-center gap-1">
              {platforms.map((p) => (
                <span key={p} className={cn('h-2 w-2 rounded-full', PLATFORM_COLOURS[p])} title={p} />
              ))}
            </div>
          )}
          {compliancePassed === true && <Check className="h-3.5 w-3.5 text-emerald-400" />}
          {blockedByHealth && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
        </div>

        <div className="ml-auto flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => onSave('draft')}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editMode ? 'Update draft' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={() => setPickingTime((open) => !open)}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40"
          >
            <Clock className="h-4 w-4" />
            Pick a time
          </button>
          <button
            type="button"
            onClick={() => nextSlotIso && onSave('schedule', nextSlotIso)}
            disabled={disabled || !nextSlotIso}
            title={nextSlotIso ? slotLabel(nextSlotIso) : 'Set posting times under Social → Schedule first'}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-40"
          >
            Next free slot
            {nextSlotIso ? (
              <span className="text-[11px] font-normal text-muted-foreground">{slotLabel(nextSlotIso)}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => onSave('now')}
            disabled={disabled || blockedByHealth}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--brand-deep, var(--foreground))' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Post now
          </button>
        </div>
      </div>

      {pickingTime ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
            When
            <input
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            disabled={disabled || !when}
            onClick={() => {
              const iso = new Date(when).toISOString()
              onSave('schedule', iso)
              setPickingTime(false)
            }}
            className="rounded-md px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
            style={{ background: 'var(--brand-deep, var(--foreground))' }}
          >
            Schedule
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          Save a draft to review later, pick a time or the next free slot on the plan, or post now.
        </p>
        {blockedByHealth && (
          <span className="text-[10px] font-medium text-red-400">Fix the health check before posting</span>
        )}
      </div>
    </div>
  )
}
