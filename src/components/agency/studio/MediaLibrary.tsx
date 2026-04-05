'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tag } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { MediaUploader } from '@/components/agency/MediaUploader'
import { MediaLibraryFilters } from './MediaLibraryFilters'
import { MediaLibraryCard } from './MediaLibraryCard'
import type { MediaItemWithUsage } from '@/types/database'

type TypeFilter = 'all' | 'image' | 'video' | 'audio'
type SortOption = 'newest' | 'oldest' | 'name' | 'most_used'

export function MediaLibrary() {
  const { activeBrandId, setPendingReviewMessage } = useAgencyStore()

  const [items, setItems] = useState<MediaItemWithUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [sort, setSort] = useState<SortOption>('newest')
  const [showArchived, setShowArchived] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [bulkTagInput, setBulkTagInput] = useState(false)
  const [bulkTagValue, setBulkTagValue] = useState('')

  const fetchMedia = useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    const params = new URLSearchParams({ brandId: activeBrandId })
    if (search) params.set('search', search)
    if (selectedTags.length) params.set('tags', selectedTags.join(','))
    if (showArchived) params.set('archived', 'true')
    if (typeFilter !== 'all') params.set('type', typeFilter)
    params.set('sort', sort)

    try {
      const res = await fetch(`/api/media?${params}`)
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [activeBrandId, search, selectedTags, showArchived, typeFilter, sort])

  const fetchTags = useCallback(async () => {
    if (!activeBrandId) return
    const res = await fetch(
      `/api/media?action=tags&brandId=${activeBrandId}`
    )
    if (res.ok) {
      const data = await res.json()
      setAvailableTags(data.tags ?? [])
    }
  }, [activeBrandId])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  useEffect(() => {
    fetchTags()
  }, [fetchTags])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTagAdd = async (id: string, tag: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tags: [...(item.tags ?? []), tag] }),
    })
    fetchMedia()
    fetchTags()
  }

  const handleTagRemove = async (id: string, tag: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        tags: (item.tags ?? []).filter((t) => t !== tag),
      }),
    })
    fetchMedia()
  }

  const handleArchive = async (id: string) => {
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_archived: true }),
    })
    fetchMedia()
  }

  const handleUnarchive = async (id: string) => {
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_archived: false }),
    })
    fetchMedia()
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/media?id=${id}`, { method: 'DELETE' })
    fetchMedia()
  }

  const handleGenerate = async (id: string) => {
    const res = await fetch(`/api/media/${id}/generate`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      alert(
        `Generated ${data.scheduledPosts?.length ?? 0} platform variants! Check the Outputs library.`
      )
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  const handleRepurpose = (id: string) => {
    setPendingReviewMessage(
      `Repurpose media item ${id} into clips, quotes, blog, newsletter, and social posts`
    )
  }

  const handleBulkTag = async (tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: Array.from(selectedIds),
        tags_add: [trimmed],
      }),
    })
    setSelectedIds(new Set())
    setBulkTagInput(false)
    setBulkTagValue('')
    fetchMedia()
    fetchTags()
  }

  const handleBulkArchive = async () => {
    await fetch('/api/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ids: Array.from(selectedIds),
        is_archived: true,
      }),
    })
    setSelectedIds(new Set())
    fetchMedia()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">
          Select a brand first to manage media.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto p-6">
      <MediaUploader brandId={activeBrandId} onUploadComplete={fetchMedia} />

      <MediaLibraryFilters
        search={search}
        onSearchChange={setSearch}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        selectedTags={selectedTags}
        onSelectedTagsChange={setSelectedTags}
        availableTags={availableTags}
        sort={sort}
        onSortChange={setSort}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[oklch(0.55_0.1_240)]/30 bg-[oklch(0.55_0.1_240)]/5 px-4 py-2">
          <span className="text-sm text-foreground">
            {selectedIds.size} selected
          </span>

          {bulkTagInput ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={bulkTagValue}
                onChange={(e) => setBulkTagValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBulkTag(bulkTagValue)
                  if (e.key === 'Escape') {
                    setBulkTagInput(false)
                    setBulkTagValue('')
                  }
                }}
                placeholder="Tag name..."
                autoFocus
                className="h-7 w-28 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => handleBulkTag(bulkTagValue)}
                className="rounded-md bg-[oklch(0.55_0.1_240)] px-2 py-1 text-xs text-white hover:bg-[oklch(0.50_0.1_240)]"
              >
                Add
              </button>
            </div>
          ) : (
            <button
              onClick={() => setBulkTagInput(true)}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
            >
              <Tag className="h-3 w-3" />
              Tag Selected
            </button>
          )}

          <button
            onClick={handleBulkArchive}
            className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium hover:bg-muted/80"
          >
            Archive Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading media...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No media found. Upload some files above.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <MediaLibraryCard
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              onSelect={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev)
                  next.has(id) ? next.delete(id) : next.add(id)
                  return next
                })
              }}
              onTagAdd={handleTagAdd}
              onTagRemove={handleTagRemove}
              onTagClick={(tag) => setSelectedTags([tag])}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              onDelete={handleDelete}
              onGenerate={handleGenerate}
              onRepurpose={handleRepurpose}
              availableTags={availableTags}
            />
          ))}
        </div>
      )}
    </div>
  )
}
