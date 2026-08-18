'use client'

import * as React from 'react'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DAY_NAMES_SHORT, friendlyTime, timezoneLabel, type WeekTime } from './rhythms'

/**
 * Empty the week — the one destructive control on this screen.
 *
 * It confirms first and it lists what goes, day by day. "Are you sure?" over an
 * unnamed change is not a confirmation, it is a speed bump: the person clicking
 * it cannot check the answer. Twenty-eight times is a lot to lose to a mis-click
 * on a screen whose whole point is that setting them was one click.
 *
 * It also says what does NOT go. Posts already waiting to publish keep their own
 * times — emptying the schedule is not cancelling this week's posting, and the
 * owner should not have to find that out afterwards.
 */
export function ClearWeek({
  slots,
  timezone,
  clearing,
  error,
  onClear,
}: {
  slots: readonly WeekTime[]
  timezone: string
  clearing: boolean
  error: string | null
  onClear: () => void
}) {
  const [confirming, setConfirming] = React.useState(false)

  const byDay = React.useMemo(() => {
    const map = new Map<number, string[]>()
    for (const slot of [...slots].sort(
      (a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time),
    )) {
      map.set(slot.day_of_week, [...(map.get(slot.day_of_week) ?? []), friendlyTime(slot.time)])
    }
    return [...map.entries()]
  }, [slots])

  if (slots.length === 0) return null

  return (
    <>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
          style={{ color: 'var(--st-fail, oklch(0.58 0.17 27))' }}
        >
          <Trash2 className="size-4" />
          <span className="ml-2">Clear the week</span>
        </Button>
      </div>

      {confirming && (
        <Dialog open onOpenChange={(open) => !open && !clearing && setConfirming(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                Remove all {slots.length} posting {slots.length === 1 ? 'time' : 'times'}?
              </DialogTitle>
              <DialogDescription>
                Your week goes back to empty. Posts already waiting to go out keep the times they
                have — this only clears the schedule they were picked from.
              </DialogDescription>
            </DialogHeader>

            {/* Exactly what will be removed, so the confirmation can be checked
                rather than merely acknowledged. */}
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2 text-[12px]"
              style={{ borderColor: 'var(--line, var(--border))' }}
            >
              {byDay.map(([day, times]) => (
                <li key={day} className="flex gap-2">
                  <span className="w-9 shrink-0 font-semibold text-foreground">
                    {DAY_NAMES_SHORT[day]}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{times.join(', ')}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11.5px] text-muted-foreground">
              All {timezoneLabel(timezone)}.
            </p>

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={clearing}>
                Keep them
              </Button>
              <Button variant="destructive" size="sm" onClick={onClear} disabled={clearing}>
                {clearing ? 'Clearing…' : 'Remove them all'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
