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
import { DAY_NAMES, friendlyTime, joinNames, timezoneLabel } from './rhythms'

/**
 * Add or change one time.
 *
 * ── The network picker is gone, on purpose ─────────────────────────────
 * It used to ask "Where" and offer six networks, including three this business
 * may never have connected. That made a posting time a per-network thing, which
 * is not the decision anybody on this screen is making: they are deciding when
 * to post, and it goes everywhere they have connected. The dialog now says
 * where the time will post rather than asking, and the route fans one time out
 * to a row per connected network so the table's per-network unique key is
 * satisfied without the owner ever meeting it.
 *
 * A time that already covers only some accounts keeps that — it is shown here
 * and left alone rather than silently widened.
 */

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

export interface SlotEditorValue {
  id?: string
  day_of_week: number
  /** "HH:MM". */
  time: string
  timezone: string
  /** Empty means every connected account — which is nearly always the case. */
  platforms: string[]
}

export interface SlotEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: SlotEditorValue | null
  /** True when this business's schedule is the real queue that fires by itself. */
  queueBacked: boolean
  /** Owner-facing names of everywhere a time posts. */
  accountNames: readonly string[]
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
  accountNames,
  onSave,
  onDelete,
  saving = false,
  error = null,
}: SlotEditorProps) {
  const [dayOfWeek, setDayOfWeek] = React.useState<number>(initial?.day_of_week ?? 1)
  const [time, setTime] = React.useState<string>(initial?.time ?? '09:00')
  const [timezone, setTimezone] = React.useState<string>(initial?.timezone ?? 'Australia/Brisbane')

  React.useEffect(() => {
    if (!open) return
    setDayOfWeek(initial?.day_of_week ?? 1)
    setTime(toHHMM(initial?.time ?? '09:00'))
    setTimezone(initial?.timezone ?? 'Australia/Brisbane')
  }, [open, initial])

  const isEditing = Boolean(initial?.id)
  const existingPlatforms = initial?.platforms ?? []
  const partial = existingPlatforms.length > 0

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      day_of_week: dayOfWeek,
      time,
      timezone,
      // Carried through untouched. Widening a time the owner narrowed earlier
      // would start posting to accounts they had deliberately left out.
      platforms: existingPlatforms,
    })
  }

  async function handleDelete() {
    if (!initial?.id || !onDelete) return
    await onDelete(initial.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Change this time' : 'Add a posting time'}</DialogTitle>
          <DialogDescription>
            {queueBacked
              ? 'Posts you line up go out at these times, in order.'
              : 'These times are offered to you whenever you schedule a post.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slot-day">Day</Label>
            <select
              id="slot-day"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DAY_NAMES.map((label, idx) => (
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
            <p className="text-[11.5px] text-muted-foreground">
              {friendlyTime(toHHMM(time))} {timezoneLabel(timezone)}.
            </p>
          </div>

          {/* Stated, not asked. See the note at the top of this file. */}
          <div
            className="rounded-md border px-3 py-2 text-[12px] text-muted-foreground"
            style={{
              borderColor: 'var(--line, var(--border))',
              background: 'var(--brand-wash, transparent)',
            }}
          >
            {partial ? (
              <>
                This time posts to{' '}
                <span className="font-semibold text-foreground">{joinNames(existingPlatforms)}</span>{' '}
                only. Remove it and add it again to have it cover everything.
              </>
            ) : accountNames.length > 0 ? (
              <>
                This time posts to{' '}
                <span className="font-semibold text-foreground">{joinNames([...accountNames])}</span>.
              </>
            ) : (
              <>This time posts to every account you have connected.</>
            )}
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
                  {timezoneLabel(tz)}
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
