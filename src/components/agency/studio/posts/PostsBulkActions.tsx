'use client'

import { useState } from 'react'
import { Trash2, Copy, X, Loader2, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PostLabelPicker } from './PostLabelPicker'
import type { PostLabel } from '@/lib/posts/post-labels'

interface PostsBulkActionsProps {
  selectedIds: string[]
  labels: PostLabel[]
  onClear: () => void
  onRefetch: () => Promise<void> | void
  onCreateLabel: (name: string, colour: string) => Promise<PostLabel | null>
}

type BulkAction = 'delete' | 'duplicate' | 'label'

/**
 * The bar that floats up when rows are ticked.
 *
 * ── What was wrong ─────────────────────────────────────────────────────
 * Duplicate fetched `/api/scheduled-posts?ids=<id>` one row at a time. That
 * route required `brandId` and answered 400 without it, so every fetch failed,
 * `valid` was empty, `Promise.allSettled([])` produced no rejections,
 * `failed.length === 0` — and the bar cleared the selection and reported
 * success having created nothing at all. A button that lies about what it did
 * is worse than a button that is missing.
 *
 * It now reads the rows in ONE request (the route takes `ids` and lets RLS scope
 * them), creates each copy through the ordinary draft route — which goes
 * through `createDraftPost()`, the only place a draft is born — and reports the
 * real number both ways round.
 *
 * ── What was removed ───────────────────────────────────────────────────
 * Bulk reschedule and bulk status changes are gone. Mixpost's own bulk bar on
 * this list has exactly one action, and a `prompt('YYYY-MM-DDTHH:mm')` in front
 * of a non-technical owner was never a feature. Labels stay, because labelling a
 * batch is the one thing a selection is genuinely for.
 */
export function PostsBulkActions({
  selectedIds,
  labels,
  onClear,
  onRefetch,
  onCreateLabel,
}: PostsBulkActionsProps) {
  const [running, setRunning] = useState<BulkAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  // The picker is a set, so the bar has to hold the set. Applying on every tick
  // would mean the second label replaced the first, which is not what ticking
  // two boxes means anywhere else in the app.
  const [pendingLabels, setPendingLabels] = useState<string[]>([])

  if (selectedIds.length === 0) return null

  const readSelected = async (): Promise<Array<Record<string, unknown>>> => {
    const res = await fetch(`/api/scheduled-posts?ids=${selectedIds.join(',')}`)
    if (!res.ok) throw new Error('Those posts could not be read.')
    const data = await res.json()
    return Array.isArray(data) ? data : []
  }

  const handleDuplicate = async () => {
    setRunning('duplicate')
    setError(null)
    setDone(null)
    try {
      const rows = await readSelected()
      if (rows.length === 0) {
        setError('Nothing could be copied — those posts could not be read.')
        return
      }

      const results = await Promise.allSettled(
        rows.map((source) =>
          fetch('/api/scheduled-posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandId: source.brand_id,
              platform: source.platform,
              caption: source.caption,
              hashtags: (source.hashtags as string[] | undefined) ?? [],
              scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
              status: 'draft',
              media_item_ids: (source.media_item_ids as string[] | undefined) ?? [],
              post_type: (source.post_type as string | undefined) ?? 'single',
              metadata: { source: 'post_creator', duplicated_from: source.id },
            }),
          }).then((res) => {
            if (!res.ok) throw new Error(`copy failed for ${String(source.id)}`)
            return res
          }),
        ),
      )

      const made = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - made

      await onRefetch()

      if (made === 0) {
        setError('No copies were made.')
        return
      }
      setDone(
        failed === 0
          ? `${made} ${made === 1 ? 'copy' : 'copies'} saved as drafts.`
          : `${made} of ${results.length} copied. ${failed} could not be.`,
      )
      if (failed === 0) onClear()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nothing was copied.')
    } finally {
      setRunning(null)
    }
  }

  const handleDelete = async () => {
    if (
      !confirm(
        `Delete ${selectedIds.length} post${selectedIds.length === 1 ? '' : 's'} from your desk? ` +
          'Anything already live stays live — take those down one at a time so you can see what comes off.',
      )
    ) {
      return
    }
    setRunning('delete')
    setError(null)
    setDone(null)
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          fetch(`/api/social/posts/${id}?scope=app`, { method: 'DELETE' }).then((res) => {
            if (!res.ok) throw new Error(`delete failed for ${id}`)
            return res
          }),
        ),
      )
      const removed = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.length - removed
      await onRefetch()
      if (failed > 0) {
        setError(`${failed} of ${results.length} could not be deleted.`)
      } else {
        setDone(`${removed} moved to deleted.`)
        onClear()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nothing was deleted.')
    } finally {
      setRunning(null)
    }
  }

  const handleLabel = async (labelIds: string[]) => {
    setRunning('label')
    setError(null)
    setDone(null)
    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          fetch('/api/scheduled-posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, labelIds }),
          }).then((res) => {
            if (!res.ok) throw new Error(`labels failed for ${id}`)
            return res
          }),
        ),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      await onRefetch()
      if (failed > 0) {
        setError(`${failed} of ${results.length} could not be labelled.`)
      } else {
        setDone(`Labels set on ${results.length}.`)
        setPendingLabels([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Labels were not changed.')
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-lg ring-1 ring-foreground/5">
        <span className="text-xs font-medium tabular-nums text-foreground">
          {selectedIds.length} selected
        </span>
        <span className="h-4 w-px bg-border" />

        <Button variant="ghost" size="sm" onClick={handleDuplicate} disabled={running !== null}>
          {running === 'duplicate' ? <Loader2 className="animate-spin" /> : <Copy />}
          Make copies
        </Button>

        <span className="inline-flex items-center gap-1">
          {running === 'label' ? (
            <Button variant="ghost" size="sm" disabled>
              <Loader2 className="animate-spin" />
              <Tag />
            </Button>
          ) : (
            <PostLabelPicker
              available={labels}
              selectedIds={pendingLabels}
              onChange={setPendingLabels}
              onCreate={onCreateLabel}
              triggerLabel={
                pendingLabels.length > 0 ? `${pendingLabels.length} chosen` : 'Choose labels'
              }
            />
          )}
          {pendingLabels.length > 0 && running !== 'label' && (
            <Button variant="ghost" size="sm" onClick={() => void handleLabel(pendingLabels)}>
              Apply
            </Button>
          )}
        </span>

        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={running !== null}>
          {running === 'delete' ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Delete
        </Button>

        <span className="h-4 w-px bg-border" />
        <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
          <X />
        </Button>
      </div>
      {error && <p className="mt-2 text-center text-xs text-destructive">{error}</p>}
      {done && !error && <p className="mt-2 text-center text-xs text-muted-foreground">{done}</p>}
    </div>
  )
}
