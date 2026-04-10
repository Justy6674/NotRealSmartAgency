'use client'

import { useEffect, useState } from 'react'
import { MoreHorizontal, Pencil, Copy, CalendarClock, Trash2, ImageIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  PLATFORM_BRAND_COLOURS,
  POST_STATUS_COLOURS,
  type PlatformKey,
  type PostStatusKey,
} from '@/lib/mixpost/ui-tokens'
import type { ScheduledPost, MediaItem } from '@/types/database'

interface PostsTableProps {
  posts: ScheduledPost[]
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: (ids: string[]) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onReschedule: (id: string) => void
  onDelete: (id: string) => void
  loading: boolean
}

const PLATFORM_LABEL_SHORT: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  linkedin: 'LI',
  twitter: 'X',
  tiktok: 'TT',
  youtube: 'YT',
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function captionSnippet(caption: string | null, max = 80): string {
  if (!caption) return '(no caption)'
  const trimmed = caption.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

interface MediaCacheEntry {
  url: string | null
  type: string | null
}

/**
 * In-component cache for the first media_item thumbnail per post. We don't
 * have a join helper for scheduled_posts.media_item_ids[0], so each row
 * fetches /api/media/<id> on mount and stashes the URL by media id. The
 * fetch is fire-and-forget — failures degrade gracefully to a placeholder.
 */
const mediaCache = new Map<string, MediaCacheEntry>()

function useMediaThumb(mediaId: string | null) {
  const [entry, setEntry] = useState<MediaCacheEntry | null>(
    mediaId ? mediaCache.get(mediaId) ?? null : null
  )

  useEffect(() => {
    if (!mediaId) return
    if (mediaCache.has(mediaId)) {
      setEntry(mediaCache.get(mediaId)!)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/media?ids=${mediaId}`)
        if (!res.ok) return
        const data = (await res.json()) as MediaItem[] | { items?: MediaItem[] }
        const items = Array.isArray(data) ? data : data.items ?? []
        const item = items.find((m) => m.id === mediaId)
        if (!item) return
        const next: MediaCacheEntry = {
          url: item.thumbnail_url ?? item.file_url ?? null,
          type: item.file_type ?? null,
        }
        mediaCache.set(mediaId, next)
        if (!cancelled) setEntry(next)
      } catch {
        /* swallow */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mediaId])

  return entry
}

function PostRow(props: {
  post: ScheduledPost
  selected: boolean
  onToggleSelect: (id: string) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onReschedule: (id: string) => void
  onDelete: (id: string) => void
}) {
  const { post, selected, onToggleSelect, onEdit, onDuplicate, onReschedule, onDelete } = props
  const firstMediaId = post.media_item_ids?.[0] ?? post.media_item_id ?? null
  const thumb = useMediaThumb(firstMediaId)

  const platformColour =
    PLATFORM_BRAND_COLOURS[post.platform as PlatformKey] ?? '#888888'
  const statusColours =
    POST_STATUS_COLOURS[post.status as PostStatusKey] ?? POST_STATUS_COLOURS.draft

  return (
    <tr className="border-b border-border/60 hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(post.id)}
          aria-label={`Select post ${post.id.slice(0, 8)}`}
          className="h-3.5 w-3.5 rounded border-border accent-foreground"
        />
      </td>
      <td className="px-2 py-2 align-middle">
        <div className="h-10 w-10 overflow-hidden rounded-md border border-border bg-muted flex items-center justify-center">
          {thumb?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb.url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </td>
      <td className="px-2 py-2 align-middle min-w-0">
        <p className="text-sm text-foreground line-clamp-2 max-w-md">
          {captionSnippet(post.caption)}
        </p>
        {post.hashtags?.length > 0 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
            {post.hashtags.slice(0, 4).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
          </p>
        )}
      </td>
      <td className="px-2 py-2 align-middle">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: `color-mix(in oklch, ${platformColour} 15%, transparent)`,
            color: platformColour,
          }}
        >
          {PLATFORM_LABEL_SHORT[post.platform] ?? post.platform}
        </span>
      </td>
      <td className="px-2 py-2 align-middle">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
          style={{
            backgroundColor: statusColours.bg,
            color: statusColours.fg,
          }}
        >
          {post.status}
        </span>
      </td>
      <td className="px-2 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(post.scheduled_at)}
      </td>
      <td className="px-2 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(post.published_at)}
      </td>
      <td className="px-2 py-2 align-middle text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(triggerProps) => (
              <Button
                {...triggerProps}
                variant="ghost"
                size="icon-sm"
                aria-label="Open row actions"
              >
                <MoreHorizontal />
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit(post.id)}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(post.id)}>
              <Copy />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReschedule(post.id)}>
              <CalendarClock />
              Reschedule
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(post.id)}>
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

export function PostsTable(props: PostsTableProps) {
  const {
    posts,
    selectedIds,
    onToggleSelect,
    onToggleSelectAll,
    onEdit,
    onDuplicate,
    onReschedule,
    onDelete,
    loading,
  } = props

  const allSelected = posts.length > 0 && posts.every((p) => selectedIds.has(p.id))
  const someSelected = posts.some((p) => selectedIds.has(p.id))

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground tracking-wide">
              <th className="px-3 py-2 text-left w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected
                  }}
                  onChange={() => onToggleSelectAll(posts.map((p) => p.id))}
                  aria-label="Select all rows"
                  className="h-3.5 w-3.5 rounded border-border accent-foreground"
                />
              </th>
              <th className="px-2 py-2 text-left w-12">Media</th>
              <th className="px-2 py-2 text-left">Caption</th>
              <th className="px-2 py-2 text-left">Platform</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Scheduled</th>
              <th className="px-2 py-2 text-left">Published</th>
              <th className="px-2 py-2 text-right w-12"></th>
            </tr>
          </thead>
          <tbody>
            {loading && posts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  Loading posts…
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-sm text-muted-foreground">
                  No posts match the current filters.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  selected={selectedIds.has(post.id)}
                  onToggleSelect={onToggleSelect}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  onReschedule={onReschedule}
                  onDelete={onDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
