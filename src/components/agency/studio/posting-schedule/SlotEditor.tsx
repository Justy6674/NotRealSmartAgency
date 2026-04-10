'use client'

import * as React from 'react'
import { Trash2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PLATFORM_LABELS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import type { PostingScheduleSlot } from '@/types/database'

const PLATFORM_OPTIONS: PlatformKey[] = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
]

const TIMEZONE_OPTIONS = [
  'Australia/Brisbane',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Adelaide',
  'Australia/Darwin',
  'Australia/Hobart',
  'UTC',
]

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface SlotEditorValue {
  id?: string
  platform: PlatformKey
  day_of_week: number
  /** "HH:MM" */
  time: string
  timezone: string
}

export interface SlotEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: SlotEditorValue | null
  /** Called with the new value (id is undefined for create). */
  onSave: (value: SlotEditorValue) => Promise<void> | void
  /** Called when the user clicks delete on an existing slot. */
  onDelete?: (id: string) => Promise<void> | void
  saving?: boolean
  error?: string | null
}

export function SlotEditor({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
  saving = false,
  error = null,
}: SlotEditorProps) {
  const [platform, setPlatform] = React.useState<PlatformKey>(initial?.platform ?? 'facebook')
  const [dayOfWeek, setDayOfWeek] = React.useState<number>(initial?.day_of_week ?? 1)
  const [time, setTime] = React.useState<string>(initial?.time ?? '09:00')
  const [timezone, setTimezone] = React.useState<string>(initial?.timezone ?? 'Australia/Brisbane')

  // Reset form whenever the editor opens with a new slot
  React.useEffect(() => {
    if (!open) return
    setPlatform(initial?.platform ?? 'facebook')
    setDayOfWeek(initial?.day_of_week ?? 1)
    setTime(toHHMM(initial?.time ?? '09:00'))
    setTimezone(initial?.timezone ?? 'Australia/Brisbane')
  }, [open, initial])

  const isEditing = Boolean(initial?.id)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      id: initial?.id,
      platform,
      day_of_week: dayOfWeek,
      time,
      timezone,
    })
  }

  async function handleDelete() {
    if (!initial?.id || !onDelete) return
    if (typeof window !== 'undefined' && !window.confirm('Delete this slot? Drafts already in this slot will be unscheduled.')) {
      return
    }
    await onDelete(initial.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit posting slot' : 'Add posting slot'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slot-platform">Platform</Label>
            <select
              id="slot-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlatformKey)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slot-day">Day of week</Label>
            <select
              id="slot-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DAY_LABELS.map((label, idx) => (
                <option key={idx} value={idx}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slot-time">Time</Label>
            <Input
              id="slot-time"
              type="time"
              step={60}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slot-tz">Timezone</Label>
            <select
              id="slot-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="flex flex-row items-center justify-between gap-2">
            {isEditing && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                onClick={handleDelete}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={saving}
              >
                <Trash2 className="mr-1 size-4" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : isEditing ? 'Save' : 'Add slot'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function toHHMM(value: string): string {
  // Postgres `time` returns "HH:MM:SS"; <input type="time"> wants "HH:MM"
  const [h = '00', m = '00'] = value.split(':')
  return `${h}:${m}`
}
