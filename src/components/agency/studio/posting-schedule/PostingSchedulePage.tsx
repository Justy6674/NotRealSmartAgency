'use client'

import * as React from 'react'
import { Calendar, Loader2, RefreshCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { DirectorAssistBar } from '@/components/agency/studio/DirectorAssistBar'
import type { PostingScheduleSlot } from '@/types/database'
import { PLATFORM_LABELS, type PlatformKey } from '@/lib/mixpost/ui-tokens'

import { WeeklySlotGrid } from './WeeklySlotGrid'
import { SlotEditor, type SlotEditorValue } from './SlotEditor'

export function PostingSchedulePage() {
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const studioData = useStudioData(activeBrandId)
  const brandName = studioData.brand?.name ?? 'this brand'

  const [slots, setSlots] = React.useState<PostingScheduleSlot[]>([])
  const [queuedCounts, setQueuedCounts] = React.useState<Record<string, number>>({})
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [editorOpen, setEditorOpen] = React.useState(false)
  const [editorInitial, setEditorInitial] = React.useState<SlotEditorValue | null>(null)
  const [editorSaving, setEditorSaving] = React.useState(false)
  const [editorError, setEditorError] = React.useState<string | null>(null)

  const loadSlots = React.useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/posting-schedule?brandId=${activeBrandId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Failed to load slots (${res.status})`)
      }
      const data = (await res.json()) as PostingScheduleSlot[]
      setSlots(data)

      // Best-effort: load queued counts. We aggregate client-side because
      // the cron route + EnhancedCalendar will own the live counts later.
      // For now we just bump the chip badges based on existing scheduled_posts.
      try {
        const countRes = await fetch(
          `/api/scheduled-posts?brandId=${activeBrandId}&hasQueueSlot=1`,
        )
        if (countRes.ok) {
          const countBody = (await countRes.json()) as Array<{ queue_slot_id: string | null }>
          const counts: Record<string, number> = {}
          for (const row of countBody ?? []) {
            if (row.queue_slot_id) counts[row.queue_slot_id] = (counts[row.queue_slot_id] ?? 0) + 1
          }
          setQueuedCounts(counts)
        }
      } catch {
        // Non-fatal: queue counts are decoration only
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  React.useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  function handleAddSlot(dayOfWeek: number) {
    setEditorInitial({
      platform: 'facebook',
      day_of_week: dayOfWeek,
      time: '09:00',
      timezone: 'Australia/Brisbane',
    })
    setEditorError(null)
    setEditorOpen(true)
  }

  function handleEditSlot(slot: PostingScheduleSlot) {
    setEditorInitial({
      id: slot.id,
      platform: slot.platform as PlatformKey,
      day_of_week: slot.day_of_week,
      time: slot.time,
      timezone: slot.timezone,
    })
    setEditorError(null)
    setEditorOpen(true)
  }

  async function handleMoveSlot(slotId: string, newDayOfWeek: number) {
    // Optimistic update
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, day_of_week: newDayOfWeek } : s)))
    try {
      const res = await fetch('/api/posting-schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slotId, day_of_week: newDayOfWeek }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to move slot')
      }
    } catch (e) {
      // Roll back by re-fetching
      await loadSlots()
      const msg = e instanceof Error ? e.message : 'Move failed'
      setError(msg)
    }
  }

  async function handleDeleteSlot(slotId: string) {
    if (typeof window !== 'undefined' && !window.confirm('Delete this slot?')) return
    // Optimistic
    setSlots((prev) => prev.filter((s) => s.id !== slotId))
    try {
      const res = await fetch(`/api/posting-schedule?id=${slotId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to delete slot')
      }
    } catch (e) {
      await loadSlots()
      const msg = e instanceof Error ? e.message : 'Delete failed'
      setError(msg)
    }
  }

  async function handleEditorSave(value: SlotEditorValue) {
    setEditorSaving(true)
    setEditorError(null)
    try {
      const isUpdate = Boolean(value.id)
      const res = await fetch('/api/posting-schedule', {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isUpdate
            ? {
                id: value.id,
                platform: value.platform,
                day_of_week: value.day_of_week,
                time: value.time,
                timezone: value.timezone,
              }
            : {
                brandId: activeBrandId,
                platform: value.platform,
                day_of_week: value.day_of_week,
                time: value.time,
                timezone: value.timezone,
              },
        ),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Save failed (${res.status})`)
      }
      setEditorOpen(false)
      await loadSlots()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      setEditorError(msg)
    } finally {
      setEditorSaving(false)
    }
  }

  async function handleEditorDelete(id: string) {
    setEditorSaving(true)
    setEditorError(null)
    try {
      const res = await fetch(`/api/posting-schedule?id=${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Delete failed (${res.status})`)
      }
      setEditorOpen(false)
      await loadSlots()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed'
      setEditorError(msg)
    } finally {
      setEditorSaving(false)
    }
  }

  // Per-platform summary
  const summary = React.useMemo(() => {
    const map: Record<string, number> = {}
    for (const slot of slots) {
      map[slot.platform] = (map[slot.platform] ?? 0) + 1
    }
    return map
  }, [slots])

  if (!activeBrandId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Pick a brand from the sidebar to set up its posting schedule.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Calendar className="size-6 text-muted-foreground" />
            Posting schedule
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Define recurring weekly slots once. Drop drafts into the queue and they will publish at the next open
            slot for their platform — no time-picking required.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadSlots} disabled={loading}>
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

      {Object.keys(summary).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary).map(([platform, count]) => (
            <span
              key={platform}
              className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {PLATFORM_LABELS[platform as PlatformKey] ?? platform}: {count} slot{count === 1 ? '' : 's'}
            </span>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <WeeklySlotGrid
        slots={slots}
        queuedCounts={queuedCounts}
        onAddSlot={handleAddSlot}
        onEditSlot={handleEditSlot}
        onMoveSlot={handleMoveSlot}
        onDeleteSlot={handleDeleteSlot}
      />

      <SlotEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editorInitial}
        saving={editorSaving}
        error={editorError}
        onSave={handleEditorSave}
        onDelete={handleEditorDelete}
      />
    </div>
  )
}
