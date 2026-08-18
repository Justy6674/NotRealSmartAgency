'use client'

import * as React from 'react'
import { Trash2 } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'

const PLATFORM_OPTIONS = ['facebook', 'instagram', 'linkedin', 'twitter', 'tiktok', 'youtube']

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
  day_of_week: number
  /** "HH:MM". */
  time: string
  timezone: string
  /** Null on a business whose schedule is the real queue — it is not per network. */
  platform: string | null
}

export interface SlotEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: SlotEditorValue | null
  /**
   * True when this business's schedule is the real queue. The queue belongs to
   * the business rather than to one network, so the platform field is hidden
   * rather than shown and ignored.
   */
  queueBacked: boolean
  onSave: (value: SlotEditorValue) => Promise<void> | void
  onDelete?: (id: string) => Promise<void> | void
  saving?: boolean
  error?: string | null
}

export function SlotEditor({
  open,
  onOpenChange,
  initial,
  queueBacked,
  onSave,
  onDelete,
  saving = false,
  error = null,
}: SlotEditorProps) {
  const [dayOfWeek, setDayOfWeek] = React.useState<number>(initial?.day_of_week ?? 1)
  const [time, setTime] = React.useState<string>(initial?.time ?? '09:00')
  const [timezone, setTimezone] = React.useState<string>(initial?.timezone ?? 'Australia/Brisbane')
  const [platform, setPlatform] = React.useState<string>(initial?.platform ?? 'facebook')

  React.useEffect(() => {
    if (!open) return
    setDayOfWeek(initial?.day_of_week ?? 1)
    setTime(toHHMM(initial?.time ?? '09:00'))
    setTimezone(initial?.timezone ?? 'Australia/Brisbane')
    setPlatform(initial?.platform ?? 'facebook')
  }, [open, initial])

  const isEditing = Boolean(initial?.id)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      id: initial?.id,
      day_of_week: dayOfWeek,
      time,
      timezone,
      platform: queueBacked ? null : platform,
    })
  }

  async function handleDelete() {
    if (!initial?.id || !onDelete) return
    if (
      typeof window !== 'undefined' &&
      !window.confirm('Remove this time? Anything already booked into it keeps its own time.')
    ) {
      return
    }
    await onDelete(initial.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Change this time' : 'Add a posting time'}</DialogTitle>
          <DialogDescription>
            {queueBacked
              ? 'Posts added to the queue go out at these times, in order.'
              : 'These times are offered to you when you schedule a post.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          {!queueBacked && (
            <div className="space-y-2">
              <Label htmlFor="slot-platform">Where</Label>
              <select
                id="slot-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {ownerFacingPlatformLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="slot-day">Day</Label>
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
            <Label htmlFor="slot-tz">Time zone</Label>
            <select
              id="slot-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TIMEZONE_OPTIONS.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace('Australia/', '')}
                </option>
              ))}
            </select>
            <p className="text-[11.5px] text-muted-foreground">
              One zone for the whole week. Changing it here moves every time on the grid.
            </p>
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
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : isEditing ? 'Save' : 'Add it'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function toHHMM(value: string): string {
  const [h = '00', m = '00'] = value.split(':')
  return `${h}:${m}`
}
