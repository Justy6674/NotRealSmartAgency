'use client'

import * as React from 'react'
import { Calendar, Check, Loader2, RefreshCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { DirectorAssistBar } from '@/components/agency/studio/DirectorAssistBar'

import { WeeklySlotGrid, type DeskScheduleSlot } from './WeeklySlotGrid'
import { SlotEditor, type SlotEditorValue } from './SlotEditor'
import { RhythmPicker } from './RhythmPicker'
import { ClearWeek } from './ClearWeek'
import {
  DAY_NAMES,
  audienceRhythm,
  friendlyTime,
  joinNames,
  nudgeTime,
  timezoneLabel,
  type BestTime,
  type WeekTime,
} from './rhythms'

/**
 * Posting times.
 *
 * ── What this replaces, and why ────────────────────────────────────────
 * The screen opened on an empty seven-column grid. Scent Sell has no posting
 * times, so what the owner saw was seven boxes saying "No times" and no way
 * forward that did not involve twenty-eight dialogs. Two people use this — one
 * of them works entirely from buttons on the glass — so a blank grid is not a
 * slow start, it is the feature not existing.
 *
 * Options first, therefore: four named rhythms and, when this business's own
 * results can carry it, a fifth built from them. One click fills the week and
 * saves it. That is the entire required interaction. The grid is still here,
 * below, pre-filled, for the moving and nudging afterwards — a bonus, not the
 * price of entry.
 *
 * ── Nothing is ever written on the owner's behalf ──────────────────────
 * No week is seeded on load, on first visit, or as a "sensible default" behind
 * the scenes. Every time on this screen exists because Justin or Bec pressed
 * something. The empty state sells the first press; it does not make it.
 *
 * ── Every change saves itself ──────────────────────────────────────────
 * There is no Save button to forget. A rhythm, a nudge, a drag, an add, a
 * removal — each one writes and says so quietly, and each one puts the old week
 * back if the write fails, so the screen never shows a week that is not saved.
 */

interface ScheduleView {
  source: 'queue' | 'local'
  timezone: string
  queueId: string | null
  slots: DeskScheduleSlot[]
  accounts: Array<{ platform: string; label: string }>
  nextSlots: string[]
  bestTimes: BestTime[]
  bestTimesPostsCounted: number
  unavailable?: string
}

const EMPTY: ScheduleView = {
  source: 'local',
  timezone: 'Australia/Brisbane',
  queueId: null,
  slots: [],
  accounts: [],
  nextSlots: [],
  bestTimes: [],
  bestTimesPostsCounted: 0,
}

/** How long the "saved" line stays up. Long enough to read, short enough to trust. */
const CONFIRMATION_MS = 4000

export function PostingSchedulePage() {
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const studioData = useStudioData(activeBrandId)
  const brandName = studioData.brand?.name ?? 'this business'

  const [view, setView] = React.useState<ScheduleView>(EMPTY)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState<string | null>(null)

  const [applying, setApplying] = React.useState<string | null>(null)
  /** Read synchronously in the handler — React state is a render behind. */
  const applyingRef = React.useRef(false)
  const [clearing, setClearing] = React.useState(false)
  const [clearError, setClearError] = React.useState<string | null>(null)

  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorInitial, setEditorInitial] = React.useState<SlotEditorValue | null>(null)
  const [editorSaving, setEditorSaving] = React.useState(false)
  const [editorError, setEditorError] = React.useState<string | null>(null)

  const queueBacked = view.source === 'queue'
  const accountNames = React.useMemo(
    () => view.accounts.map((account) => account.label),
    [view.accounts],
  )

  /** The quiet confirmation. No dialog, no button to dismiss. */
  const confirm = React.useCallback((message: string) => {
    setSaved(message)
    setError(null)
  }, [])

  React.useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(null), CONFIRMATION_MS)
    return () => clearTimeout(timer)
  }, [saved])

  const load = React.useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    setError(null)
    try {
      // `hints=1` is what fetches this business's own results. Asked for here
      // rather than on every read, so the composer's next-free-time lookup does
      // not quietly make an analytics call as well.
      const res = await fetch(`/api/posting-schedule?brandId=${activeBrandId}&desk=1&hints=1`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Your posting times could not be loaded.')
      }
      const data = (await res.json()) as ScheduleView
      setView({ ...EMPTY, ...data })
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
   * Both the queue and the local table take the week as one list, so a partial
   * save would silently drop the days it left out. Building the week here and
   * sending all of it keeps the grid and what is stored describing the same
   * thing. A time carries no network: the route fans one time out to a row per
   * connected account, which is what the table's unique key needs and what the
   * owner means by "post at nine".
   */
  const saveWeek = React.useCallback(
    async (slots: readonly WeekTime[], timezone: string): Promise<ScheduleView> => {
      if (!activeBrandId) throw new Error('Pick a business first.')
      const res = await fetch('/api/posting-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          timezone,
          slots: slots.map((slot) => ({
            day_of_week: slot.day_of_week,
            time: slot.time,
            ...(slot.platforms && slot.platforms.length > 0 ? { platforms: slot.platforms } : {}),
          })),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Your posting times could not be saved.')
      }
      return (await res.json()) as ScheduleView
    },
    [activeBrandId],
  )

  /** The week as it stands, in the shape everything else here speaks. */
  const currentWeek = React.useMemo<WeekTime[]>(
    () =>
      view.slots.map((slot) => ({
        day_of_week: slot.day_of_week,
        time: slot.time,
        platforms: slot.platforms,
      })),
    [view.slots],
  )

  /**
   * Apply the week, keeping what was there if the write fails.
   *
   * The old week is put back rather than left showing the new one, because a
   * grid that shows times nothing saved is the exact failure this screen exists
   * to end.
   */
  const applyWeek = React.useCallback(
    async (next: readonly WeekTime[], message: string, key: string) => {
      /*
       * One write at a time.
       *
       * Every write here is a whole-week replace, so a second one started
       * before the first came back would be built from the week BEFORE the
       * first change and would undo it — silently, and only sometimes, which is
       * the worst way for a schedule to be wrong. Nudging twice quickly is the
       * obvious way to hit it.
       */
      if (applyingRef.current) return
      applyingRef.current = true
      const before = view
      setApplying(key)
      setError(null)
      // Optimistic, so the week fills the instant the card is pressed.
      setView((current) => ({
        ...current,
        slots: next.map((slot) => ({
          id: `pending-${slot.day_of_week}-${slot.time}`,
          day_of_week: slot.day_of_week,
          time: slot.time,
          platforms: slot.platforms ?? [],
          upcoming: 0,
        })),
      }))
      try {
        const result = await saveWeek(next, view.timezone)
        setView({ ...EMPTY, ...result, bestTimes: before.bestTimes, bestTimesPostsCounted: before.bestTimesPostsCounted, accounts: result.accounts.length > 0 ? result.accounts : before.accounts })
        confirm(message)
      } catch (e) {
        setView(before)
        setError(e instanceof Error ? e.message : 'Your posting times could not be saved.')
      } finally {
        applyingRef.current = false
        setApplying(null)
      }
    },
    [view, saveWeek, confirm],
  )

  function handleApplyRhythm(id: string, name: string, times: WeekTime[]) {
    void applyWeek(
      times,
      `${name} is set — ${times.length} ${times.length === 1 ? 'time' : 'times'} a week, saved.`,
      id,
    )
  }

  function handleAddSlot(dayOfWeek: number) {
    setEditorInitial({ day_of_week: dayOfWeek, time: '09:00', timezone: view.timezone, platforms: [] })
    setEditorError(null)
    setEditorOpen(true)
  }

  function handleEditSlot(slot: DeskScheduleSlot) {
    setEditorInitial({
      id: slot.id,
      day_of_week: slot.day_of_week,
      time: slot.time,
      timezone: view.timezone,
      platforms: slot.platforms,
    })
    setEditorError(null)
    setEditorOpen(true)
  }

  function handleMoveSlot(slotId: string, newDayOfWeek: number) {
    const index = view.slots.findIndex((s) => s.id === slotId)
    if (index < 0) return
    const slot = view.slots[index]!
    const next = currentWeek.map((entry, i) =>
      i === index ? { ...entry, day_of_week: newDayOfWeek } : entry,
    )
    void applyWeek(
      next,
      `Moved to ${dayName(newDayOfWeek)} at ${friendlyTime(slot.time)}. Saved.`,
      `move-${slotId}`,
    )
  }

  function handleNudgeSlot(slotId: string, minutes: number) {
    const index = view.slots.findIndex((s) => s.id === slotId)
    if (index < 0) return
    const moved = nudgeTime(view.slots[index]!.time, minutes)
    const next = currentWeek.map((entry, i) => (i === index ? { ...entry, time: moved } : entry))
    void applyWeek(next, `Now ${friendlyTime(moved)}. Saved.`, `nudge-${slotId}`)
  }

  function handleDeleteSlot(slotId: string) {
    const index = view.slots.findIndex((s) => s.id === slotId)
    if (index < 0) return
    const removed = view.slots[index]!
    const next = currentWeek.filter((_, i) => i !== index)
    void applyWeek(
      next,
      `${dayName(removed.day_of_week)} at ${friendlyTime(removed.time)} removed.`,
      `remove-${slotId}`,
    )
  }

  async function handleEditorSave(value: SlotEditorValue) {
    setEditorSaving(true)
    setEditorError(null)
    try {
      const index = value.id ? view.slots.findIndex((s) => s.id === value.id) : -1
      const entry: WeekTime = {
        day_of_week: value.day_of_week,
        time: value.time,
        platforms: value.platforms,
      }
      const next = index >= 0
        ? currentWeek.map((existing, i) => (i === index ? entry : existing))
        : [...currentWeek, entry]

      const before = view
      const result = await saveWeek(next, value.timezone)
      setView({
        ...EMPTY,
        ...result,
        bestTimes: before.bestTimes,
        bestTimesPostsCounted: before.bestTimesPostsCounted,
        accounts: result.accounts.length > 0 ? result.accounts : before.accounts,
      })
      confirm(
        `${dayName(value.day_of_week)} at ${friendlyTime(value.time)} saved.`,
      )
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
      const index = view.slots.findIndex((s) => s.id === id)
      if (index < 0) return
      const removed = view.slots[index]!
      const before = view
      const result = await saveWeek(currentWeek.filter((_, i) => i !== index), view.timezone)
      setView({
        ...EMPTY,
        ...result,
        bestTimes: before.bestTimes,
        bestTimesPostsCounted: before.bestTimesPostsCounted,
        accounts: result.accounts.length > 0 ? result.accounts : before.accounts,
      })
      confirm(`${dayName(removed.day_of_week)} at ${friendlyTime(removed.time)} removed.`)
      setEditorOpen(false)
    } catch (e) {
      setEditorError(e instanceof Error ? e.message : 'That time could not be removed.')
    } finally {
      setEditorSaving(false)
    }
  }

  /**
   * Clear the week.
   *
   * Routed through the dedicated clear call rather than saving an empty week,
   * because on a queue-backed business the two are not the same thing: this
   * removes the schedule itself, and the call is guarded by naming the schedule
   * it means to clear — upstream, the same call with that name missing removes
   * every schedule on the account.
   */
  async function handleClear() {
    if (!activeBrandId) return
    setClearing(true)
    setClearError(null)
    try {
      const query = new URLSearchParams({ brandId: activeBrandId, all: '1' })
      query.set('queueId', view.queueId ?? 'local')
      const res = await fetch(`/api/posting-schedule?${query.toString()}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Your posting times could not be cleared.')
      const before = view
      setView({
        ...EMPTY,
        ...(body as ScheduleView),
        bestTimes: before.bestTimes,
        bestTimesPostsCounted: before.bestTimesPostsCounted,
        accounts: before.accounts,
      })
      confirm('Your week is empty. Pick a rhythm whenever you are ready.')
    } catch (e) {
      setClearError(e instanceof Error ? e.message : 'Your posting times could not be cleared.')
    } finally {
      setClearing(false)
    }
  }

  const audience = React.useMemo(
    () => audienceRhythm(view.bestTimes, view.bestTimesPostsCounted),
    [view.bestTimes, view.bestTimesPostsCounted],
  )

  const nextFew = React.useMemo(
    () =>
      view.nextSlots.slice(0, 6).flatMap((iso) => {
        const when = new Date(iso)
        return Number.isNaN(when.getTime())
          ? []
          : [
              when.toLocaleString('en-AU', {
                timeZone: view.timezone,
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              }),
            ]
      }),
    [view.nextSlots, view.timezone],
  )

  if (!activeBrandId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Pick a business from the sidebar to set up its posting times.
      </div>
    )
  }

  const empty = view.slots.length === 0

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
              ? 'Your week, in order. Anything you line up goes out at the next free time on it.'
              : 'Your week. These times are offered to you whenever you schedule a post.'}{' '}
            All times are{' '}
            <span className="font-semibold text-foreground">{timezoneLabel(view.timezone)}</span>
            {accountNames.length > 0 ? (
              <>
                {' '}and every one of them posts to {joinNames(accountNames)}.
              </>
            ) : (
              <>.</>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </header>

      {/*
        The empty state sells the first click rather than apologising for it.
        This is what Scent Sell shows today: no times at all.
      */}
      {empty && !loading && (
        <div
          className="rounded-xl border p-4"
          style={{
            borderColor: 'var(--brand, var(--border))',
            background: 'var(--brand-wash, transparent)',
          }}
        >
          <p className="text-sm font-semibold text-foreground">
            Your week is wide open. Set it in one click.
          </p>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
            Pick one of the rhythms below and every day of your week is filled straight away — no
            forms, nothing to remember to save. Change any of it afterwards, or start again whenever
            you like.
          </p>
        </div>
      )}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <RhythmPicker
        saved={currentWeek}
        audience={audience}
        accountNames={accountNames}
        applying={applying}
        prominent={empty}
        onApply={handleApplyRhythm}
      />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">Your week</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {empty
                ? 'Nothing set yet. Pick a rhythm above, or add times one at a time here.'
                : 'Drag a time to another day, use the arrows to move it earlier or later, or click it to change it. Everything saves as you go.'}
            </p>
          </div>
          {/* The quiet confirmation lives beside the thing it is confirming. */}
          <p
            aria-live="polite"
            className="flex min-h-[1.25rem] items-center gap-1.5 text-[12.5px]"
            style={{ color: saved ? 'var(--ok, oklch(0.55 0.13 155))' : 'transparent' }}
          >
            {saved ? (
              <>
                <Check className="size-3.5" />
                {saved}
              </>
            ) : null}
          </p>
        </div>

        <WeeklySlotGrid
          slots={view.slots}
          countsAreReal={queueBacked}
          accountNames={accountNames}
          onAddSlot={handleAddSlot}
          onEditSlot={handleEditSlot}
          onMoveSlot={handleMoveSlot}
          onNudgeSlot={handleNudgeSlot}
          onDeleteSlot={handleDeleteSlot}
        />
      </section>

      {/* The queue's own answer to "when will my next posts go out". If this
          disagrees with the grid above, the grid is wrong — this is the list
          the scheduler works from. */}
      {queueBacked && !empty && nextFew.length > 0 && (
        <section
          className="rounded-xl border p-4"
          style={{ borderColor: 'var(--line, var(--border))', background: 'var(--card, transparent)' }}
        >
          <h2 className="text-sm font-semibold text-foreground">Next times coming up</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {nextFew.map((label, index) => (
              <li
                key={`${label}-${index}`}
                className="rounded-full border px-3 py-1 text-xs tabular-nums text-muted-foreground"
                style={{
                  borderColor: 'var(--line, var(--border))',
                  background: 'var(--panel-2, transparent)',
                }}
              >
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            {timezoneLabel(view.timezone)}, as always.
          </p>
        </section>
      )}

      <ClearWeek
        slots={currentWeek}
        timezone={view.timezone}
        clearing={clearing}
        error={clearError}
        onClear={handleClear}
      />

      <DirectorAssistBar
        brandName={brandName}
        buttons={[
          {
            label: 'Ask about my posting times',
            prompt: `Look at ${brandName}'s posting times and connected accounts. Tell me in plain English whether the week I have set looks sensible for this business, and what you would change. Do not change anything — just tell me.`,
          },
        ]}
      />

      <SlotEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorInitial}
        queueBacked={queueBacked}
        accountNames={accountNames}
        saving={editorSaving}
        error={editorError}
        onSave={handleEditorSave}
        onDelete={handleEditorDelete}
      />
    </div>
  )
}

function dayName(day: number): string {
  return DAY_NAMES[day] ?? 'that day'
}
