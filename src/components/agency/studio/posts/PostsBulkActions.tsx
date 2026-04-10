'use client'

import { useState } from 'react'
import { Trash2, Copy, CalendarClock, Archive, FileEdit, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PostsBulkActionsProps {
  selectedIds: string[]
  onClear: () => void
  /** Refetches the list after a bulk mutation completes successfully. */
  onRefetch: () => Promise<void> | void
}

type BulkAction = 'delete' | 'duplicate' | 'reschedule' | 'to_draft' | 'to_cancelled'

/**
 * Sticky bottom bar that floats above the Posts Index when one or more
 * rows are selected. All actions hit /api/scheduled-posts (PATCH) directly
 * since the route ships PATCH but no DELETE — "delete" maps to a status
 * change to 'cancelled' which the cron publisher and the Review tab both
 * exclude from active queues.
 *
 * Duplicate uses POST /api/scheduled-posts with the existing row's payload
 * after fetching it via GET. Reschedule isn't fully wired here — it just
 * returns the IDs to the parent for now (the parent owns the date picker
 * modal in PostsIndex).
 */
export function PostsBulkActions({ selectedIds, onClear, onRefetch }: PostsBulkActionsProps) {
  const [running, setRunning] = useState<BulkAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (selectedIds.length === 0) return null

  const runPatchAll = async (
    label: BulkAction,
    body: Record<string, unknown>
  ) => {
    setRunning(label)
    setError(null)
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          fetch('/api/scheduled-posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...body }),
          })
        )
      )
      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      )
      if (failed.length > 0) {
        setError(`${failed.length} of ${selectedIds.length} posts failed to update`)
      }
      await onRefetch()
      if (failed.length === 0) onClear()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk update failed')
    } finally {
      setRunning(null)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} post${selectedIds.length === 1 ? '' : 's'}? This sets their status to cancelled.`)) {
      return
    }
    await runPatchAll('delete', { status: 'cancelled' })
  }

  const handleDuplicate = async () => {
    setRunning('duplicate')
    setError(null)
    try {
      const fetched = await Promise.all(
        selectedIds.map(async (id) => {
          const res = await fetch(`/api/scheduled-posts?ids=${id}`)
          if (!res.ok) return null
          const arr = await res.json()
          return Array.isArray(arr) ? arr.find((p: { id: string }) => p.id === id) : null
        })
      )
      const valid = fetched.filter((p): p is Record<string, unknown> & { brand_id: string; platform: string; caption: string } => !!p)
      const results = await Promise.allSettled(
        valid.map((source) =>
          fetch('/api/scheduled-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandId: source.brand_id,
              platform: source.platform,
              caption: source.caption,
              hashtags: (source as { hashtags?: string[] }).hashtags ?? [],
              scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
              status: 'draft',
              media_item_ids: (source as { media_item_ids?: string[] }).media_item_ids ?? [],
              post_type: (source as { post_type?: string }).post_type ?? 'single',
              metadata: { source: 'duplicate' },
            }),
          })
        )
      )
      const failed = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
      )
      if (failed.length > 0) {
        setError(`${failed.length} of ${valid.length} duplicates failed`)
      }
      await onRefetch()
      if (failed.length === 0) onClear()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicate failed')
    } finally {
      setRunning(null)
    }
  }

  const handleReschedule = async () => {
    const value = prompt('Reschedule to (YYYY-MM-DDTHH:mm, e.g. 2026-04-15T14:00)')
    if (!value) return
    const iso = new Date(value).toISOString()
    if (Number.isNaN(new Date(iso).getTime())) {
      setError('Invalid date')
      return
    }
    await runPatchAll('reschedule', { scheduled_at: iso, status: 'scheduled' })
  }

  const handleToDraft = () => runPatchAll('to_draft', { status: 'draft' })
  const handleToCancelled = () => runPatchAll('to_cancelled', { status: 'cancelled' })

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg ring-1 ring-foreground/5">
        <span className="text-xs font-medium text-foreground">
          {selectedIds.length} selected
        </span>
        <span className="h-4 w-px bg-border" />

        <Button variant="ghost" size="sm" onClick={handleDuplicate} disabled={running !== null}>
          {running === 'duplicate' ? <Loader2 className="animate-spin" /> : <Copy />}
          Duplicate
        </Button>
        <Button variant="ghost" size="sm" onClick={handleReschedule} disabled={running !== null}>
          {running === 'reschedule' ? <Loader2 className="animate-spin" /> : <CalendarClock />}
          Reschedule
        </Button>
        <Button variant="ghost" size="sm" onClick={handleToDraft} disabled={running !== null}>
          {running === 'to_draft' ? <Loader2 className="animate-spin" /> : <FileEdit />}
          To draft
        </Button>
        <Button variant="ghost" size="sm" onClick={handleToCancelled} disabled={running !== null}>
          {running === 'to_cancelled' ? <Loader2 className="animate-spin" /> : <Archive />}
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={running !== null}>
          {running === 'delete' ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Delete
        </Button>

        <span className="h-4 w-px bg-border" />
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
          <X />
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-center text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
