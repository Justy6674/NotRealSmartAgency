'use client'

import { useCallback, useState } from 'react'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { usePostsList } from '@/hooks/usePostsList'
import type { StatusCounts } from '@/hooks/usePostsList'
import { Button } from '@/components/ui/button'
import { PostsFilters } from './PostsFilters'
import { PostsTable } from './PostsTable'
import { PostsBulkActions } from './PostsBulkActions'
import type { ScheduledPostStatus } from '@/types/database'

/* ── Status Tab Bar ─────────────────────────────────────────────────── */

interface StatusTab {
  key: ScheduledPostStatus | 'all'
  label: string
}

const STATUS_TABS: StatusTab[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'published', label: 'Published' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
]

function StatusTabBar({
  activeTab,
  onTabChange,
  allCount,
  statusCounts,
}: {
  activeTab: ScheduledPostStatus | 'all'
  onTabChange: (tab: ScheduledPostStatus | 'all') => void
  allCount: number
  statusCounts: StatusCounts
}) {
  return (
    <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
      {STATUS_TABS.map((tab) => {
        const count = tab.key === 'all' ? allCount : statusCounts[tab.key] ?? 0
        const isActive = activeTab === tab.key
        const isFailed = tab.key === 'failed'

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={[
              'relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              'hover:text-foreground focus-visible:outline-none',
              isActive
                ? 'text-foreground'
                : isFailed && count > 0
                  ? 'text-red-500'
                  : 'text-muted-foreground',
            ].join(' ')}
          >
            <span className={isFailed && count > 0 ? 'text-red-500' : ''}>
              {tab.label}
            </span>
            <span
              className={[
                'ml-1.5 text-xs tabular-nums',
                isActive ? 'text-foreground/70' : 'text-muted-foreground/60',
                isFailed && count > 0 ? '!text-red-500/70' : '',
              ].join(' ')}
            >
              ({count})
            </span>
            {/* Active underline */}
            {isActive && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground rounded-t" />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ── Posts Index ─────────────────────────────────────────────────────── */

/**
 * Posts Index — the All Posts surface for the active brand. Pulls from the
 * shared usePostsList hook (client-side filter, sort, pagination), wires
 * PostsFilters -> PostsTable -> PostsBulkActions, and handles per-row
 * actions (Edit jumps to the Creator route, Duplicate / Reschedule /
 * Delete delegate to PATCH /api/scheduled-posts).
 *
 * The page reads the active brand from useAgencyStore — there's no
 * brand picker on this surface; switch brand from the sidebar like every
 * other Studio page.
 */
export function PostsIndex() {
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const setPendingDraftId = useAgencyStore((s) => s.setPendingDraftId)

  const {
    posts,
    total,
    allCount,
    statusCounts,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    filters,
    setFilters,
    setPage,
    refetch,
  } = usePostsList({ brandId: activeBrandId, pageSize: 20 })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  /* Derive the active tab from the current statuses filter */
  const activeTab: ScheduledPostStatus | 'all' =
    filters.statuses && filters.statuses.length === 1
      ? filters.statuses[0]
      : 'all'

  const handleTabChange = useCallback(
    (tab: ScheduledPostStatus | 'all') => {
      if (tab === 'all') {
        const { statuses: _removed, ...rest } = filters
        setFilters(rest)
      } else {
        setFilters({ ...filters, statuses: [tab] })
      }
    },
    [filters, setFilters]
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
      if (allSelected) {
        const next = new Set(prev)
        ids.forEach((id) => next.delete(id))
        return next
      }
      const next = new Set(prev)
      ids.forEach((id) => next.add(id))
      return next
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const handleEdit = useCallback(
    (id: string) => {
      setPendingDraftId(id)
      window.location.href = '/agency/studio'
    },
    [setPendingDraftId]
  )

  const handleDuplicate = useCallback(
    async (id: string) => {
      const source = posts.find((p) => p.id === id)
      if (!source) return
      try {
        const res = await fetch('/api/scheduled-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId: source.brand_id,
            platform: source.platform,
            caption: source.caption,
            hashtags: source.hashtags ?? [],
            scheduled_at: new Date(Date.now() + 86_400_000).toISOString(),
            status: 'draft',
            media_item_ids: source.media_item_ids ?? [],
            post_type: source.post_type ?? 'single',
            metadata: { source: 'duplicate' },
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await refetch()
      } catch (err) {
        console.error('[PostsIndex] duplicate failed', err)
      }
    },
    [posts, refetch]
  )

  const handleReschedule = useCallback(
    async (id: string) => {
      const value = prompt('Reschedule to (YYYY-MM-DDTHH:mm)')
      if (!value) return
      const parsed = new Date(value)
      if (Number.isNaN(parsed.getTime())) return
      try {
        const res = await fetch('/api/scheduled-posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            scheduled_at: parsed.toISOString(),
            status: 'scheduled',
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await refetch()
      } catch (err) {
        console.error('[PostsIndex] reschedule failed', err)
      }
    },
    [refetch]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Cancel this post? Status will be set to cancelled.')) return
      try {
        const res = await fetch('/api/scheduled-posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status: 'cancelled' }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await refetch()
        setSelectedIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } catch (err) {
        console.error('[PostsIndex] delete failed', err)
      }
    },
    [refetch]
  )

  if (!activeBrandId) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Pick a brand from the sidebar to see its posts.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Status tab bar */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <StatusTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          allCount={allCount}
          statusCounts={statusCounts}
        />
      </div>

      {/* Search + Platform + Date + Sort filters */}
      <PostsFilters filters={filters} onChange={setFilters} total={total} />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <PostsTable
        posts={posts}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onEdit={handleEdit}
        onDuplicate={handleDuplicate}
        onReschedule={handleReschedule}
        onDelete={handleDelete}
        loading={loading}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
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
          <span className="px-2">
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

      <PostsBulkActions
        selectedIds={Array.from(selectedIds)}
        onClear={clearSelection}
        onRefetch={refetch}
      />
    </div>
  )
}
