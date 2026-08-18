'use client'

import * as React from 'react'
import { Loader2, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { NextFreeTimeView } from '@/components/agency/studio/post/CreatorActionBar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * The two panels the weekly grid was missing.
 *
 * Mixpost's posting-schedule screen is two stacked panels and a footer control:
 * add a time, the seven day cards, and "Clear all posting times". We had the
 * first two and no way at all to start the week again — the only way to empty a
 * schedule was to remove times one at a time, and nothing in the product ever
 * called the clear operation.
 *
 * The best-times panel has no Mixpost equivalent. It is here because the owner
 * was otherwise setting a whole week by feel, and their own audience already
 * answers the question.
 */

interface DeskSchedule {
  source: 'queue' | 'local'
  timezone: string
  queueId: string | null
  slots: Array<{ id: string; day_of_week: number; time: string }>
  nextSlots: string[]
  bestTimes: Array<{ day_of_week: number; time: string; posts: number }>
  unavailable?: string
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "09:00" → "9:00 am", so nobody reads a 24-hour clock to check their week. */
function friendlyTime(hhmm: string): string {
  const [hourText, minuteText] = hhmm.split(':')
  const hour = Number(hourText)
  if (!Number.isFinite(hour)) return hhmm
  const suffix = hour < 12 ? 'am' : 'pm'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:${minuteText ?? '00'} ${suffix}`
}

export function SchedulePanels({
  brandId,
  /** Bumped after a clear so the grid above reloads with the same truth. */
  onChanged,
}: {
  brandId: string | null
  onChanged: () => void
}) {
  const [view, setView] = React.useState<DeskSchedule | null>(null)
  /**
   * The same answer the composer's button gives.
   *
   * Read from the same place on purpose: a screen that shows a week and a
   * button that schedules against it must never be able to disagree about
   * which time comes next.
   */
  const [nextFree, setNextFree] = React.useState<NextFreeTimeView | null>(null)
  const [confirming, setConfirming] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!brandId) return
    try {
      const res = await fetch(`/api/posting-schedule?brandId=${brandId}&desk=1&hints=1`)
      if (!res.ok) return
      setView((await res.json()) as DeskSchedule)
      const free = await fetch(`/api/posting-schedule/next-free-time?brandId=${brandId}`)
      if (free.ok) setNextFree((await free.json()) as NextFreeTimeView)
    } catch {
      // The grid above reports a failed read. Saying it twice helps nobody.
    }
  }, [brandId])

  React.useEffect(() => {
    void load()
  }, [load])

  const hasTimes = (view?.slots.length ?? 0) > 0

  async function handleClear() {
    if (!brandId || !view) return
    setClearing(true)
    setError(null)
    try {
      const query = new URLSearchParams({ brandId, all: '1' })
      // The id the owner is looking at travels with the request. Upstream, this
      // call with the id MISSING wipes every schedule on the account, so the
      // client naming what it means to clear is a guard, not ceremony.
      if (view.queueId) query.set('queueId', view.queueId)
      else query.set('queueId', 'local')

      const res = await fetch(`/api/posting-schedule?${query.toString()}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Your posting times could not be cleared.')
      setView(body as DeskSchedule)
      setConfirming(false)
      setNotice('Your week is empty. Add a time whenever you are ready.')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your posting times could not be cleared.')
    } finally {
      setClearing(false)
    }
  }

  if (!brandId) return null

  return (
    <>
      {view && view.bestTimes.length > 0 && (
        <section
          className="rounded-xl border p-4"
          style={{
            borderColor: 'var(--line, var(--border))',
            background: 'var(--brand-wash, transparent)',
          }}
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="size-4" style={{ color: 'var(--brand-deep, currentColor)' }} />
            When your own audience turns up
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Worked out from how people have actually responded to this business, in your own time
            zone. Add one of these to your week if it is not there already. These are times, not
            networks: a time posts to every account you have connected.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {view.bestTimes.map((slot) => {
              const already = view.slots.some(
                (existing) => existing.day_of_week === slot.day_of_week && existing.time === slot.time,
              )
              return (
                <li
                  key={`${slot.day_of_week}-${slot.time}`}
                  className="rounded-lg border px-3 py-1.5 text-[12.5px]"
                  style={{
                    borderColor: 'var(--line, var(--border))',
                    background: 'var(--card, transparent)',
                  }}
                >
                  <span className="font-semibold text-foreground">
                    {DAY_NAMES[slot.day_of_week]} {friendlyTime(slot.time)}
                  </span>
                  <span className="ml-2 text-muted-foreground tabular-nums">
                    {slot.posts === 1 ? '1 post' : `${slot.posts} posts`}
                    {already ? ' · already in your week' : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* The next free time, in the same words the composer uses on its button.
          Without it, the only way to find out what "next free time" meant was
          to press it on a post. */}
      {nextFree?.when && nextFree.label && (
        <div
          className="rounded-lg border px-3 py-2 text-[12.5px]"
          style={{
            borderColor: 'var(--line, var(--border))',
            background: 'var(--card, transparent)',
            color: 'var(--ink-2, inherit)',
          }}
        >
          Your next free time is{' '}
          <b style={{ color: 'var(--brand-deep, currentColor)' }}>{nextFree.label}</b>. That is where
          the next post goes when you choose to add it to your next free time.
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </div>
      )}

      {hasTimes && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null)
              setConfirming(true)
            }}
            style={{ color: 'var(--st-fail, oklch(0.58 0.17 27))' }}
          >
            <Trash2 className="size-4" />
            <span className="ml-2">Clear all posting times</span>
          </Button>
        </div>
      )}

      {confirming && view && (
        <Dialog open onOpenChange={(open) => !open && setConfirming(false)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Clear every posting time?</DialogTitle>
              <DialogDescription>
                All {view.slots.length} {view.slots.length === 1 ? 'time' : 'times'} come off your
                week. Posts already waiting to go out keep their own times — this only empties the
                schedule.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={clearing}>
                Keep them
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClear} disabled={clearing}>
                {clearing ? <Loader2 className="size-4 animate-spin" /> : null}
                <span className={clearing ? 'ml-2' : ''}>Clear them all</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
