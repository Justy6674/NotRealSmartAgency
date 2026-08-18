'use client'

import * as React from 'react'
import { Calendar, Loader2, RefreshCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { DirectorAssistBar } from '@/components/agency/studio/DirectorAssistBar'

import { WeeklySlotGrid, type DeskScheduleSlot } from './WeeklySlotGrid'
import { SlotEditor, type SlotEditorValue } from './SlotEditor'

interface ScheduleView {
  source: 'queue' | 'local'
  timezone: string
  queueId: string | null
  slots: DeskScheduleSlot[]
  nextSlots: string[]
  unavailable?: string
}

const EMPTY: ScheduleView = {
  source: 'local',
  timezone: 'Australia/Brisbane',
  queueId: null,
  slots: [],
  nextSlots: [],
}

/**
 * The weekly posting schedule.
 *
 * The page used to promise "drop drafts into the queue and they will publish at
 * the next open slot" over a grid that no publishing code ever read. It is now
 * the real queue when the business is on the main posting connection: the times
 * on the grid are the times the queue itself will use, and the panel below
 * shows the next few of them straight from the queue's own preview, so the
 * promise is checkable rather than decorative.
 *
 * On the backup connection there is no queue to read, so the page says what
 * these times actually are — a plan it offers you when you schedule — instead
 * of claiming something that would not happen.
 */
export function PostingSchedulePage() {
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const studioData = useStudioData(activeBrandId)
  const brandName = studioData.brand?.name ?? 'this business'

  const [view, setView] = React.useState<ScheduleView>(EMPTY)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorInitial, setEditorInitial] = React.useState<SlotEditorValue | null>(null)
  const [editorSaving, setEditorSaving] = React.useState(false)
  const [editorError, setEditorError] = React.useState<string | null>(null)

  const queueBacked = view.source === 'queue'

  const load = React.useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/posting-schedule?brandId=${activeBrandId}&desk=1`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Your posting times could not be loaded.')
      }
      const data = (await res.json()) as ScheduleView
      setView(data)
      if (data.unavailable) setError(data.unavailable)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your posting times could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  React.useEffect(() => {
    void load()
  }, [load])

  /**
   * Every write is the whole week.
   *
   * The queue takes its times as one list, so a partial save would silently
   * drop the days it left out. Building the week here and sending all of it
   * keeps the grid and the queue describing the same thing.
   */
  const saveWeek = React.useCallback(
    async (slots: DeskScheduleSlot[], timezone: string) => {
      if (!activeBrandId) return
      const res = await fetch('/api/posting-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          timezone,
          slots: slots.map((slot) => ({
            day_of_week: slot.day_of_week,
            time: slot.time,
            platform: slot.platform,
          })),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Your posting times could not be saved.')
      }
      setView((await res.json()) as ScheduleView)
    },
    [activeBrandId],
  )

  function handleAddSlot(dayOfWeek: number) {
    setEditorInitial({
      day_of_week: dayOfWeek,
      time: '09:00',
      timezone: view.timezone,
      platform: queueBacked ? null : 'facebook',
    })
    setEditorError(null)
    setEditorOpen(true)
  }

  function handleEditSlot(slot: DeskScheduleSlot) {
    setEditorInitial({
      id: slot.id,
      day_of_week: slot.day_of_week,
      time: slot.time,
      timezone: view.timezone,
      platform: slot.platform,
    })
    setEditorError(null)
    setEditorOpen(true)
  }

  async function handleMoveSlot(slotId: string, newDayOfWeek: number) {
    const before = view.slots
    const next = before.map((slot) =>
      slot.id === slotId ? { ...slot, day_of_week: newDayOfWeek } : slot,
    )
    setView((current) => ({ ...current, slots: next }))
    try {
      await saveWeek(next, view.timezone)
    } catch (e) {
      setView((current) => ({ ...current, slots: before }))
      setError(e instanceof Error ? e.message : 'That time could not be moved.')
    }
  }

  async function handleDeleteSlot(slotId: string) {
    if (typeof window !== 'undefined' && !window.confirm('Remove this time?')) return
    const before = view.slots
    setView((current) => ({ ...current, slots: current.slots.filter((s) => s.id !== slotId) }))
    try {
      if (!activeBrandId) return
      const res = await fetch(
        `/api/posting-schedule?brandId=${activeBrandId}&id=${encodeURIComponent(slotId)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'That time could not be removed.')
      }
      setView((await res.json()) as ScheduleView)
    } catch (e) {
      setView((current) => ({ ...current, slots: before }))
      setError(e instanceof Error ? e.message : 'That time could not be removed.')
    }
  }

  async function handleEditorSave(value: SlotEditorValue) {
    setEditorSaving(true)
    setEditorError(null)
    try {
      const others = value.id ? view.slots.filter((slot) => slot.id !== value.id) : view.slots
      const next: DeskScheduleSlot[] = [
        ...others,
        {
          id: value.id ?? `new-${value.day_of_week}-${value.time}`,
          day_of_week: value.day_of_week,
          time: value.time,
          platform: value.platform,
          upcoming: 0,
        },
      ]
      await saveWeek(next, value.timezone)
      setEditorOpen(false)
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'That time could not be saved.')
    } finally {
      setEditorSaving(false)
    }
  }

  async function handleEditorDelete(id: string) {
    setEditorSaving(true)
    setEditorError(null)
    try {
      await saveWeek(
        view.slots.filter((slot) => slot.id !== id),
        view.timezone,
      )
      setEditorOpen(false)
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'That time could not be removed.')
    } finally {
      setEditorSaving(false)
    }
  }

  const nextFew = React.useMemo(
    () =>
      view.nextSlots.slice(0, 6).map((iso) => {
        const when = new Date(iso)
        return Number.isNaN(when.getTime())
          ? null
          : when.toLocaleString('en-AU', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            })
      }),
    [view.nextSlots],
  )

  if (!activeBrandId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Pick a business from the sidebar to set up its posting times.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Calendar className="size-6 text-muted-foreground" />
            Posting times
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {queueBacked
              ? 'Set your week once. Anything you add to the queue goes out at the next free time on this grid, in order.'
              : 'Set your week once and these times are offered whenever you schedule a post. They do not fire on their own on this connection.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </header>

      <DirectorAssistBar
        brandName={brandName}
        buttons={[
          {
            label: 'Optimise my schedule',
            prompt: `Look at ${brandName}'s posting schedule and connected platforms. Use platform best practices and our analytics to suggest the best posting times. Consider Australian timezones. Show me a recommended weekly schedule.`,
          },
          {
            label: 'Set up my week',
            prompt: `Set up an optimal posting schedule for ${brandName} for this week. Create time slots for each connected platform at the best engagement times. Aim for consistent coverage without overwhelming any platform.`,
          },
        ]}
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <WeeklySlotGrid
        slots={view.slots}
        countsAreReal={queueBacked}
        onAddSlot={handleAddSlot}
        onEditSlot={handleEditSlot}
        onMoveSlot={handleMoveSlot}
        onDeleteSlot={handleDeleteSlot}
      />

      {/* The queue's own answer to "when will my next posts go out". If this
          disagrees with the grid above, the grid is wrong — this is the list
          the scheduler works from. */}
      {queueBacked && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Next times coming up</h2>
          {view.slots.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              You have not set any times yet, so nothing can be queued.
            </p>
          ) : nextFew.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              No upcoming times could be worked out just now.
            </p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {nextFew.filter(Boolean).map((label, index) => (
                <li
                  key={`${label}-${index}`}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs tabular-nums text-muted-foreground"
                >
                  {label}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Times shown in {view.timezone.replace('Australia/', '')}.
          </p>
        </section>
      )}

      <SlotEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorInitial}
        queueBacked={queueBacked}
        saving={editorSaving}
        error={editorError}
        onSave={handleEditorSave}
        onDelete={handleEditorDelete}
      />
    </div>
  )
}
