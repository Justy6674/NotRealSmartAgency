'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { sendToDirector } from '@/lib/chat-dispatch'
import { usePostsList } from '@/hooks/usePostsList'
import type { DeskPostStatus, SocialPostRow, StatusCounts } from '@/hooks/usePostsList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DirectorAssistBar } from '../DirectorAssistBar'
import { PostsFilters } from './PostsFilters'
import { PostsTable } from './PostsTable'
import { PostsBulkActions } from './PostsBulkActions'
import { PostPreviewModal } from './PostPreviewModal'
import type { PostLabel } from '@/lib/posts/post-labels'

/* ── Status tabs ─────────────────────────────────────────────────────────── */

interface StatusTab {
  key: DeskPostStatus | 'all'
  label: string
  /** Rendered only when the count is above zero, the way Mixpost does. */
  conditional?: boolean
  /** Reads in the failure colour when there is anything in it. */
  alarming?: boolean
  /** A tab that covers more than one status. */
  covers?: DeskPostStatus[]
}

/**
 * Seven tabs, two of which appear only when they have something in them.
 *
 * Mixpost renders "Needs approval" and "Failed" conditionally and paints Failed
 * red, and both are right: a permanent empty "Did not go out" tab teaches the
 * owner to stop reading the tab strip, and a red one that is only ever red when
 * something is wrong keeps its meaning.
 *
 * "Waiting on you" and "Deleted" have no equivalent upstream — the publisher's
 * status enum has neither an approval nor a soft delete — so both are ours,
 * derived from `scheduled_posts`.
 */
const STATUS_TABS: StatusTab[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'needs_approval', label: 'Waiting on you', conditional: true },
  { key: 'scheduled', label: 'Waiting to go out', covers: ['scheduled', 'publishing'] },
  { key: 'published', label: 'Gone out', covers: ['published', 'partial'] },
  { key: 'failed', label: 'Did not go out', conditional: true, alarming: true },
  { key: 'cancelled', label: 'Deleted' },
]

function countFor(tab: StatusTab, allCount: number, counts: StatusCounts): number {
  if (tab.key === 'all') return allCount
  const keys = tab.covers ?? [tab.key as DeskPostStatus]
  return keys.reduce((sum, key) => sum + (counts[key] ?? 0), 0)
}

function StatusTabBar({
  activeTab,
  onTabChange,
  allCount,
  statusCounts,
}: {
  activeTab: DeskPostStatus | 'all'
  onTabChange: (tab: StatusTab) => void
  allCount: number
  statusCounts: StatusCounts
}) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto border-b border-border">
      {STATUS_TABS.map((tab) => {
        const count = countFor(tab, allCount, statusCounts)
        if (tab.conditional && count === 0 && activeTab !== tab.key) return null
        const isActive = activeTab === tab.key
        const alarming = tab.alarming && count > 0

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab)}
            style={
              isActive
                ? { color: 'var(--brand-deep, var(--foreground))' }
                : alarming
                  ? { color: 'var(--st-fail, oklch(0.58 0.17 27))' }
                  : undefined
            }
            className={[
              'relative px-4 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              'focus-visible:outline-none',
              isActive || alarming ? '' : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <span>{tab.label}</span>
            {count > 0 && (
              <span className="ml-1.5 text-xs tabular-nums opacity-70">({count})</span>
            )}
            {isActive && (
              <span
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-t"
                style={{ background: 'var(--brand, var(--foreground))' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ── Choose a time ───────────────────────────────────────────────────────── */

/**
 * Replaces `prompt('Reschedule to (YYYY-MM-DDTHH:mm)')`.
 *
 * That prompt asked a business owner to type an ISO 8601 string with a literal
 * T in the middle, and silently did nothing when they got it wrong. Two native
 * fields, pre-filled with where the post already sits.
 */
function RescheduleDialog({
  post,
  saving,
  error,
  onCancel,
  onConfirm,
}: {
  post: SocialPostRow
  saving: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (isoInstant: string) => void
}) {
  const start = post.scheduled_at ? new Date(post.scheduled_at) : new Date(Date.now() + 3_600_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const [date, setDate] = useState(
    `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
  )
  const [time, setTime] = useState(`${pad(start.getHours())}:${pad(start.getMinutes())}`)

  const submit = () => {
    // Built from the owner's own clock, so "9 am" means nine in the morning
    // where they are and not nine somewhere in Greenwich.
    const when = new Date(`${date}T${time}`)
    if (Number.isNaN(when.getTime())) return
    onConfirm(when.toISOString())
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>When should this go out?</DialogTitle>
          <DialogDescription>Pick the day and the time. Your local time.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-date">Day</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-time">Time</Label>
            <Input
              id="reschedule-time"
              type="time"
              step={60}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Move it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Three-way delete ────────────────────────────────────────────────────── */

type DeleteScope = 'app' | 'platform' | 'both'

/**
 * "Delete" is two questions, so it asks both.
 *
 * A post can be removed from this desk, taken down from the platform where it
 * is live, or both. Conflating them is how a business ends up with a post still
 * live on Instagram that its own desk says is gone — and for a business
 * advertising regulated health services, the platform arm is the only honest
 * answer to a complaint about something already public.
 */
function DeleteDialog({
  post,
  saving,
  error,
  onCancel,
  onConfirm,
}: {
  post: SocialPostRow
  saving: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (scope: DeleteScope) => void
}) {
  const isLive = post.status === 'published' || post.status === 'partial'
  const [scope, setScope] = useState<DeleteScope>(isLive ? 'both' : 'app')

  const options: Array<{ value: DeleteScope; title: string; body: string; disabled?: boolean }> = [
    {
      value: 'app',
      title: 'Just here',
      body: 'Take it off your desk. Anything already live stays exactly where it is.',
    },
    {
      value: 'both',
      title: 'Here and on the platform',
      body: 'Take it off your desk and remove the live post from the account it went to.',
      disabled: !isLive,
    },
    {
      value: 'platform',
      title: 'Only on the platform',
      body: 'Remove the live post but keep the record here, so you can see what was taken down and when.',
      disabled: !isLive,
    },
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this post</DialogTitle>
          <DialogDescription>
            {isLive
              ? 'This one is live. Choose what comes down.'
              : 'This has not gone out anywhere, so there is nothing live to remove.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => setScope(option.value)}
              className="block w-full rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style={
                scope === option.value
                  ? {
                      borderColor: 'var(--brand, currentColor)',
                      background: 'var(--brand-wash, transparent)',
                    }
                  : { borderColor: 'var(--line, var(--border))' }
              }
            >
              <p className="text-[13px] font-semibold text-foreground">{option.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{option.body}</p>
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onConfirm(scope)} disabled={saving}>
            {saving ? 'Working…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Posts index ─────────────────────────────────────────────────────────── */

export function PostsIndex() {
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const setPendingDraftId = useAgencyStore((s) => s.setPendingDraftId)
  const studioData = useStudioData(activeBrandId)
  const brandName = studioData.brand?.name ?? 'this business'
  const isHealthBrand = !!(
    studioData.brand?.compliance_flags?.ahpra || studioData.brand?.compliance_flags?.tga
  )

  const {
    posts,
    total,
    allCount,
    statusCounts,
    labels,
    accounts,
    history,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    filters,
    setFilters,
    setPage,
    refetch,
    refetchLabels,
  } = usePostsList({ brandId: activeBrandId, pageSize: 20 })

  /**
   * Whether this business has any posting times at all.
   *
   * Mixpost only offers "Add to queue" when there are times to queue into, and
   * that rule matters more here than it does there: this desk has already
   * shipped a schedule page promising a queue that nothing ever used. An
   * offer that cannot be honoured is the bug, not the missing button.
   */
  const [hasPostingTimes, setHasPostingTimes] = useState(false)

  useEffect(() => {
    if (!activeBrandId) {
      setHasPostingTimes(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/posting-schedule?brandId=${activeBrandId}&desk=1`)
        if (!res.ok) return
        const body = (await res.json()) as { source?: string; slots?: unknown[] }
        if (cancelled) return
        // Only the real queue fires by itself. The local plan is a set of
        // suggested times, so there is nothing to add a post to.
        setHasPostingTimes(body.source === 'queue' && (body.slots?.length ?? 0) > 0)
      } catch {
        // No queue offered is the safe answer to a failed read.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeBrandId])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewing, setPreviewing] = useState<SocialPostRow | null>(null)
  const [rescheduling, setRescheduling] = useState<SocialPostRow | null>(null)
  const [deleting, setDeleting] = useState<SocialPostRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const activeTab: DeskPostStatus | 'all' = useMemo(() => {
    const statuses = filters.statuses ?? []
    if (statuses.length === 0) return 'all'
    const match = STATUS_TABS.find((tab) => {
      const keys = tab.covers ?? [tab.key as DeskPostStatus]
      return keys.length === statuses.length && keys.every((key) => statuses.includes(key))
    })
    return (match?.key as DeskPostStatus | 'all') ?? 'all'
  }, [filters.statuses])

  const handleTabChange = useCallback(
    (tab: StatusTab) => {
      if (tab.key === 'all') {
        const { statuses: _removed, ...rest } = filters
        setFilters(rest)
      } else {
        setFilters({ ...filters, statuses: tab.covers ?? [tab.key as DeskPostStatus] })
      }
    },
    [filters, setFilters],
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      const next = new Set(prev)
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)))
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const handleEdit = useCallback(
    (id: string) => {
      setPendingDraftId(id)
      window.location.href = `/agency/social/compose?draft=${id}`
    },
    [setPendingDraftId],
  )

  const handleDuplicate = useCallback(
    async (id: string) => {
      const source = posts.find((p) => p.id === id)
      if (!source) return
      setNotice(null)
      try {
        // Every copy is born in `createDraftPost()` behind this route. A raw
        // insert here would skip the publisher push and the save gate both.
        const res = await fetch('/api/scheduled-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId: source.brand_id ?? activeBrandId,
            platform: source.platform,
            caption: source.caption,
            hashtags: source.hashtags,
            scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
            status: 'draft',
            media_item_ids: source.media_item_ids,
            post_type: source.post_type ?? 'single',
            metadata: { source: 'post_creator', duplicated_from: source.id },
          }),
        })
        if (!res.ok) throw new Error('The copy could not be saved.')
        await refetch()
        setNotice('Saved as a new draft.')
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'The copy could not be saved.')
      }
    },
    [posts, refetch, activeBrandId],
  )

  const handleAddToQueue = useCallback(
    async (post: SocialPostRow) => {
      setNotice(null)
      try {
        const res = await fetch('/api/posting-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId: post.brand_id ?? activeBrandId, postId: post.id }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'This could not be added to the queue.')
        await refetch()
        setNotice(body.message ?? 'Added to the queue.')
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'This could not be added to the queue.')
      }
    },
    [activeBrandId, refetch],
  )

  const handleRetry = useCallback(
    async (post: SocialPostRow) => {
      setNotice(null)
      try {
        const res = await fetch(`/api/social/posts/${post.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'retry', brandId: activeBrandId ?? undefined }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'It could not be sent again.')
        await refetch()
        setNotice(body.message ?? 'Sending again.')
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'It could not be sent again.')
      }
    },
    [refetch, activeBrandId],
  )

  const handleReschedule = useCallback(
    async (isoInstant: string) => {
      if (!rescheduling) return
      setBusy(true)
      setDialogError(null)
      try {
        const res = await fetch(`/api/social/posts/${rescheduling.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reschedule',
            scheduledFor: isoInstant,
            brandId: activeBrandId ?? undefined,
          }),
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'The new time could not be saved.')
        setRescheduling(null)
        await refetch()
        setNotice('Moved.')
      } catch (err) {
        setDialogError(err instanceof Error ? err.message : 'The new time could not be saved.')
      } finally {
        setBusy(false)
      }
    },
    [rescheduling, refetch, activeBrandId],
  )

  const handleDelete = useCallback(
    async (scope: DeleteScope) => {
      if (!deleting) return
      setBusy(true)
      setDialogError(null)
      try {
        const query = new URLSearchParams({ scope })
        if (activeBrandId) query.set('brandId', activeBrandId)
        const res = await fetch(`/api/social/posts/${deleting.id}?${query.toString()}`, {
          method: 'DELETE',
        })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(body.error ?? 'It could not be deleted.')
        setDeleting(null)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(deleting.id)
          return next
        })
        await refetch()
        // The route says what actually came down, platform by platform. A
        // takedown that half-worked has to be reported as half-worked.
        setNotice(body.message ?? 'Deleted.')
      } catch (err) {
        setDialogError(err instanceof Error ? err.message : 'It could not be deleted.')
      } finally {
        setBusy(false)
      }
    },
    [deleting, refetch, activeBrandId],
  )

  const handleSetLabels = useCallback(
    async (postId: string, labelIds: string[]) => {
      try {
        const res = await fetch('/api/scheduled-posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: postId, labelIds }),
        })
        if (!res.ok) throw new Error('Labels could not be saved.')
        await refetch()
      } catch (err) {
        setNotice(err instanceof Error ? err.message : 'Labels could not be saved.')
      }
    },
    [refetch],
  )

  const handleCreateLabel = useCallback(
    async (name: string, colour: string): Promise<PostLabel | null> => {
      if (!activeBrandId) return null
      try {
        const res = await fetch('/api/scheduled-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'label', brandId: activeBrandId, name, colour }),
        })
        if (!res.ok) return null
        const made = (await res.json()) as PostLabel
        await refetchLabels()
        return made
      } catch {
        return null
      }
    },
    [activeBrandId, refetchLabels],
  )

  const handleAskDirector = useCallback(
    (id: string) => {
      const post = posts.find((p) => p.id === id)
      if (!post) return
      const snippet = post.caption.slice(0, 120) || '(nothing written)'
      sendToDirector(
        `Review this ${post.platform} post (status: ${post.status}): "${snippet}". What can be improved? If it failed, diagnose the issue and suggest a fix.${
          isHealthBrand ? ' Check AHPRA/TGA compliance.' : ''
        }`,
      )
    },
    [posts, isHealthBrand],
  )

  if (!activeBrandId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Pick a business from the sidebar to see its posts.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <DirectorAssistBar
        brandName={brandName}
        buttons={[
          {
            label: 'Review my posts',
            prompt: `Analyse ${brandName}'s recent posts across all platforms. What's performing well, what needs improvement, and what content gaps do you see?${
              isHealthBrand ? ' Flag any AHPRA/TGA compliance concerns.' : ''
            } Use query_outputs and query_social_analytics.`,
          },
          {
            label: 'Fix failed posts',
            prompt: `Check ${brandName}'s failed posts. For each one, diagnose why it failed (missing media, API error, compliance rejection, scheduling conflict) and create a fixed version as a new draft.${
              isHealthBrand ? ' Ensure AHPRA/TGA compliance.' : ''
            }`,
          },
        ]}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <StatusTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          allCount={allCount}
          statusCounts={statusCounts}
        />
      </div>

      <PostsFilters
        filters={filters}
        onChange={setFilters}
        total={total}
        labels={labels}
        accounts={accounts}
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* History is the larger half of most brands' lists and it comes from
          somewhere this desk cannot edit, so it says so once rather than
          leaving the owner to wonder why some rows have no buttons. */}
      {history?.unavailable && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {history.unavailable}
        </div>
      )}
      {/*
        The total is deliberately not quoted here.

        `history.total` is the publisher's own count taken BEFORE this business's
        accounts are filtered out of it, so on a shared publisher it is the whole
        team's history — "210 posts" printed over three rows that belong to this
        owner. The count of rows actually shown is ours and is true; the total is
        not, so the sentence is written without it rather than with a number we
        cannot stand behind. The pre-filter total is read at
        `src/app/api/scheduled-posts/route.ts` (`readHistory`, `pagination.total`)
        and fixing it there is the real repair — that file belongs to another
        piece of work.
      */}
      {history && history.truncated && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Showing your {history.shown} most recent posts. Narrow by date to see further back.
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {notice}
        </div>
      )}

      <PostsTable
        posts={posts}
        selectedIds={selectedIds}
        labels={labels}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onPreview={setPreviewing}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onReschedule={(post) => {
          setDialogError(null)
          setRescheduling(post)
        }}
        onRetry={handleRetry}
        onAddToQueue={hasPostingTimes ? handleAddToQueue : undefined}
        onDelete={(post) => {
          setDialogError(null)
          setDeleting(post)
        }}
        onSetLabels={handleSetLabels}
        onCreateLabel={handleCreateLabel}
        onAskDirector={handleAskDirector}
        loading={loading}
      />

      {/* Mixpost hides pagination entirely below one page. Same rule. */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="tabular-nums">
            Showing {posts.length === 0 ? 0 : (page - 1) * pageSize + 1}–
            {(page - 1) * pageSize + posts.length} of {total}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft />
              Prev
            </Button>
            <span className="px-2 tabular-nums">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              aria-label="Next page"
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}

      <PostsBulkActions
        selectedIds={Array.from(selectedIds)}
        labels={labels}
        onClear={clearSelection}
        onRefetch={refetch}
        onCreateLabel={handleCreateLabel}
      />

      <PostPreviewModal
        post={previewing}
        brandName={brandName}
        onClose={() => setPreviewing(null)}
        onEdit={(id) => {
          setPreviewing(null)
          handleEdit(id)
        }}
      />

      {rescheduling && (
        <RescheduleDialog
          post={rescheduling}
          saving={busy}
          error={dialogError}
          onCancel={() => setRescheduling(null)}
          onConfirm={handleReschedule}
        />
      )}

      {deleting && (
        <DeleteDialog
          post={deleting}
          saving={busy}
          error={dialogError}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
