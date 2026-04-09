'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Check, X, ChevronUp, ChevronDown, ImagePlus, Loader2, Play, Film, Search, CheckCircle2, Sparkles } from 'lucide-react'

/**
 * Rich media item shape matching MediaItemWithUsage from /api/media.
 *
 * Kept deliberately permissive — the API returns more fields than we strictly
 * need, so unknown extras are fine.
 */
interface MediaItem {
  id: string
  file_url: string
  file_name: string
  file_type: string
  file_size_bytes: number | null
  thumbnail_url?: string | null
  duration_seconds?: number | null
  tags?: string[] | null
  created_at?: string
  file_created_at?: string | null
  transcription_status?: string
  ai_description?: string | null
  // Enriched by /api/media with usage from scheduled_posts
  usage_count?: number
  last_published_at?: string | null
}

function isVideo(item: MediaItem): boolean {
  return item.file_type?.startsWith('video/') ?? false
}

/** 12345 → "12.3 KB" / "1.5 MB" */
function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** 180 → "3:00" */
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** ISO date → "2d ago" / "3h ago" / "just now" */
function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (isNaN(then)) return ''
  const ms = Date.now() - then
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

/**
 * Renders a media thumbnail correctly for both images and videos.
 * Videos without a thumbnail_url fall back to a video icon placeholder,
 * so we never render a video URL as an <img> src (the grey-box bug).
 */
function MediaThumb({ item, className }: { item: MediaItem; className?: string }) {
  const video = isVideo(item)
  const src = video ? item.thumbnail_url : item.file_url

  if (video && !src) {
    return (
      <div className={`${className ?? ''} flex items-center justify-center bg-muted`}>
        <Film className="h-6 w-6 text-muted-foreground/50" />
      </div>
    )
  }

  return (
    <div className={`${className ?? ''} relative`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src!}
        alt={item.file_name}
        className="w-full h-full object-cover"
      />
      {video && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-full bg-black/60 p-1.5">
            <Play className="h-3 w-3 text-white fill-white" />
          </div>
        </div>
      )}
      {video && item.duration_seconds ? (
        <div className="absolute bottom-0.5 right-0.5 text-[10px] font-medium tabular-nums bg-black/70 text-white px-1 rounded">
          {formatDuration(item.duration_seconds)}
        </div>
      ) : null}
    </div>
  )
}

type SortKey = 'newest' | 'oldest' | 'most_used' | 'unused'

interface MediaSelectorProps {
  brandId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  maxCount?: number
  acceptTypes?: string[] // e.g. ['image'] or ['video']
}

export function MediaSelector({
  brandId,
  selectedIds,
  onChange,
  maxCount = 10,
  acceptTypes,
}: MediaSelectorProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('newest')

  useEffect(() => {
    if (!brandId) return
    setLoading(true)
    // Use the enriched /api/media endpoint — returns usage_count + last_published_at
    fetch(`/api/media?brandId=${brandId}&sort=newest`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        let items: MediaItem[] = Array.isArray(data) ? data : (data.items ?? [])
        if (acceptTypes?.length) {
          items = items.filter((m) =>
            acceptTypes.some((t) => m.file_type.startsWith(t)),
          )
        }
        setMediaItems(items)
      })
      .catch(() => setMediaItems([]))
      .finally(() => setLoading(false))
  }, [brandId, acceptTypes])

  const toggleSelect = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((s) => s !== id))
      } else if (selectedIds.length < maxCount) {
        onChange([...selectedIds, id])
      }
    },
    [selectedIds, onChange, maxCount],
  )

  const moveUp = useCallback(
    (index: number) => {
      if (index === 0) return
      const next = [...selectedIds]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      onChange(next)
    },
    [selectedIds, onChange],
  )

  const moveDown = useCallback(
    (index: number) => {
      if (index >= selectedIds.length - 1) return
      const next = [...selectedIds]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      onChange(next)
    },
    [selectedIds, onChange],
  )

  const selectedItems = selectedIds
    .map((id) => mediaItems.find((m) => m.id === id))
    .filter(Boolean) as MediaItem[]

  // Apply search + sort to the library list
  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    let result = mediaItems
    if (term) {
      result = result.filter((m) => {
        const hay = [
          m.file_name,
          m.ai_description ?? '',
          (m.tags ?? []).join(' '),
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(term)
      })
    }
    // Sort
    const sorted = [...result]
    switch (sortKey) {
      case 'newest':
        sorted.sort((a, b) =>
          (b.created_at ?? '').localeCompare(a.created_at ?? ''),
        )
        break
      case 'oldest':
        sorted.sort((a, b) =>
          (a.created_at ?? '').localeCompare(b.created_at ?? ''),
        )
        break
      case 'most_used':
        sorted.sort(
          (a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0),
        )
        break
      case 'unused':
        sorted.sort((a, b) => {
          const aUsed = (a.usage_count ?? 0) > 0 ? 1 : 0
          const bUsed = (b.usage_count ?? 0) > 0 ? 1 : 0
          if (aUsed !== bUsed) return aUsed - bUsed // unused first
          return (b.created_at ?? '').localeCompare(a.created_at ?? '')
        })
        break
    }
    return sorted
  }, [mediaItems, search, sortKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* ── Selected items (ordered) ─────────────────────────────────────── */}
      {selectedItems.length > 0 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Selected ({selectedItems.length}/{maxCount})
          </label>
          <div className="flex gap-2 flex-wrap">
            {selectedItems.map((item, i) => (
              <div
                key={item.id}
                className="relative group rounded-lg overflow-hidden border border-border bg-muted"
                style={{ width: 72, height: 72 }}
              >
                <MediaThumb item={item} className="w-full h-full" />
                {/* Order badge */}
                <span className="absolute top-1 left-1 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {i + 1}
                </span>
                {/* Controls overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => moveUp(i)}
                      className="p-0.5 rounded bg-white/20 hover:bg-white/40"
                    >
                      <ChevronUp className="h-3 w-3 text-white" />
                    </button>
                  )}
                  {i < selectedItems.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveDown(i)}
                      className="p-0.5 rounded bg-white/20 hover:bg-white/40"
                    >
                      <ChevronDown className="h-3 w-3 text-white" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleSelect(item.id)}
                    className="p-0.5 rounded bg-red-500/60 hover:bg-red-500/80"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Library ──────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            {selectedItems.length > 0 ? 'Add more' : 'Select from library'}
            {mediaItems.length > 0 && (
              <span className="ml-2 text-muted-foreground/60">
                ({filteredItems.length}
                {search && filteredItems.length !== mediaItems.length
                  ? ` of ${mediaItems.length}`
                  : ''}
                )
              </span>
            )}
          </label>
          {mediaItems.length > 0 && (
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="text-[11px] bg-muted border border-border rounded px-1.5 py-0.5 outline-none focus:border-primary"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="most_used">Most used</option>
              <option value="unused">Unused first</option>
            </select>
          )}
        </div>

        {mediaItems.length > 0 && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search filename, tags, or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-7 pr-2 py-1.5 bg-muted border border-border rounded outline-none focus:border-primary"
            />
          </div>
        )}

        {mediaItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed border-border">
            {acceptTypes?.length === 1 && acceptTypes[0] === 'video' ? (
              <>
                <Film className="h-6 w-6 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">No videos in your library yet</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">
                  Upload one in the Media tab, or generate with HeyGen
                </p>
              </>
            ) : (
              <>
                <ImagePlus className="h-6 w-6 text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">
                  No {acceptTypes?.length === 1 && acceptTypes[0] === 'image' ? 'images' : 'media'} in your library yet
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">
                  Upload in the Media tab first
                </p>
              </>
            )}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground/60">
            Nothing matches "{search}"
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id)
              const isDisabled = !isSelected && selectedIds.length >= maxCount
              const uploadedAt = formatRelativeTime(item.created_at)
              const isNew = (() => {
                if (!item.created_at) return false
                return Date.now() - new Date(item.created_at).getTime() < 24 * 60 * 60 * 1000
              })()
              const usageCount = item.usage_count ?? 0
              const lastUsed = formatRelativeTime(item.last_published_at)
              const size = formatSize(item.file_size_bytes)
              const duration = formatDuration(item.duration_seconds)
              const tags = (item.tags ?? []).slice(0, 3)

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSelect(item.id)}
                  disabled={isDisabled}
                  title={item.ai_description ?? item.file_name}
                  className={`w-full flex items-start gap-3 p-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : isDisabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-muted'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="shrink-0 relative">
                    <MediaThumb item={item} className="w-16 h-16 rounded overflow-hidden" />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 rounded-full bg-primary p-0.5">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Line 1: filename + new badge */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate flex-1">
                        {item.file_name}
                      </span>
                      {isNew && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1 py-px rounded">
                          <Sparkles className="h-2 w-2" /> NEW
                        </span>
                      )}
                    </div>

                    {/* Line 2: size · duration · uploaded date */}
                    <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1.5 flex-wrap">
                      {duration && <span className="tabular-nums">{duration}</span>}
                      {duration && size && <span>·</span>}
                      {size && <span className="tabular-nums">{size}</span>}
                      {(duration || size) && uploadedAt && <span>·</span>}
                      {uploadedAt && <span>Uploaded {uploadedAt}</span>}
                    </div>

                    {/* Line 3: usage badge + tags */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {usageCount > 0 ? (
                        <span
                          className="inline-flex items-center gap-0.5 text-[9px] font-medium text-blue-600 bg-blue-500/10 px-1.5 py-px rounded"
                          title={lastUsed ? `Last published ${lastUsed}` : undefined}
                        >
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Used {usageCount}×
                          {lastUsed ? ` · ${lastUsed}` : ''}
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-muted-foreground/60 bg-muted px-1.5 py-px rounded">
                          Unused
                        </span>
                      )}
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] text-muted-foreground bg-muted/60 px-1.5 py-px rounded truncate max-w-[80px]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
