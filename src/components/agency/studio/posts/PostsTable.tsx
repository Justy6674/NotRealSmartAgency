'use client'

import { useEffect, useState } from 'react'
import { MoreHorizontal, Pencil, Copy, CalendarClock, Sparkles, Trash2, ImageIcon } from 'lucide-react'
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
  onAskDirector?: (id: string) => void
  loading: boolean
}

/** Single-letter abbreviation for the platform avatar circle. */
const PLATFORM_INITIAL: Record<string, string> = {
  instagram: 'I',
  facebook: 'F',
  linkedin: 'L',
  twitter: 'X',
  tiktok: 'T',
  youtube: 'Y',
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '\u2014'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '\u2014'
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
  return `${trimmed.slice(0, max)}\u2026`
}

interface MediaCacheEntry {
  url: string | null
  type: string | null
}

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

/* ── Status Dot ─────────────────────────────────────────────────────── */

function StatusDot({ status }: { status: string }) {
  const colours = POST_STATUS_COLOURS[status as PostStatusKey] ?? POST_STATUS_COLOURS.draft
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
      style={{ backgroundColor: colours.fg }}
      title={status}
    />
  )
}

/* ── Platform Avatar ────────────────────────────────────────────────── */

function PlatformAvatar({ platform }: { platform: string }) {
  const colour = PLATFORM_BRAND_COLOURS[platform as PlatformKey] ?? '#888888'
  const initial = PLATFORM_INITIAL[platform] ?? platform.charAt(0).toUpperCase()
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
      style={{ backgroundColor: colour }}
      title={platform}
    >
      {initial}
    </span>
  )
}

/* ── Post Row ───────────────────────────────────────────────────────── */

function PostRow(props: {
  post: ScheduledPost
  selected: boolean
  onToggleSelect: (id: string) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onReschedule: (id: string) => void
  onDelete: (id: string) => void
  onAskDirector?: (id: string) => void
}) {
  const { post, selected, onToggleSelect, onEdit, onDuplicate, onReschedule, onDelete, onAskDirector } = props
  const firstMediaId = post.media_item_ids?.[0] ?? post.media_item_id ?? null
  const thumb = useMediaThumb(firstMediaId)

  return (
    <tr className="border-b border-border/40 hover:bg-muted/20 transition-colors">
      {/* Checkbox */}
      <td className="px-2 py-1.5 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(post.id)}
          aria-label={`Select post ${post.id.slice(0, 8)}`}
          className="h-3.5 w-3.5 rounded border-border accent-foreground"
        />
      </td>
      {/* Status dot */}
      <td className="px-1.5 py-1.5 align-middle">
        <StatusDot status={post.status} />
      </td>
      {/* Thumbnail */}
      <td className="px-1.5 py-1.5 align-middle">
        <div className="h-8 w-8 overflow-hidden rounded border border-border bg-muted flex items-center justify-center">
          {thumb?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb.url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </td>
      {/* Caption */}
      <td className="px-1.5 py-1.5 align-middle min-w-0">
        <p className="text-sm text-foreground line-clamp-1 max-w-md leading-tight">
          {captionSnippet(post.caption)}
        </p>
        {post.hashtags?.length > 0 && (
          <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-1 leading-tight">
            {post.hashtags.slice(0, 4).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
          </p>
        )}
      </td>
      {/* Platform avatar */}
      <td className="px-1.5 py-1.5 align-middle">
        <PlatformAvatar platform={post.platform} />
      </td>
      {/* Scheduled */}
      <td className="px-1.5 py-1.5 align-middle text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(post.scheduled_at)}
      </td>
      {/* Published */}
      <td className="px-1.5 py-1.5 align-middle text-xs text-muted-foreground whitespace-nowrap">
        {formatDateTime(post.published_at)}
      </td>
      {/* Actions */}
      <td className="px-1.5 py-1.5 align-middle text-right">
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
            {onAskDirector && (
              <DropdownMenuItem onClick={() => onAskDirector(post.id)}>
                <Sparkles />
                Ask Director
              </DropdownMenuItem>
            )}
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

/* ── Posts Table ─────────────────────────────────────────────────────── */

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
    onAskDirector,
    loading,
  } = props

  const allSelected = posts.length > 0 && posts.every((p) => selectedIds.has(p.id))
  const someSelected = posts.some((p) => selectedIds.has(p.id))

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase text-muted-foreground tracking-wide">
              <th className="px-2 py-1.5 text-left w-8">
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
              <th className="px-1.5 py-1.5 text-left w-6" title="Status"></th>
              <th className="px-1.5 py-1.5 text-left w-10">Media</th>
              <th className="px-1.5 py-1.5 text-left">Caption</th>
              <th className="px-1.5 py-1.5 text-left w-10">Acct</th>
              <th className="px-1.5 py-1.5 text-left">Scheduled</th>
              <th className="px-1.5 py-1.5 text-left">Published</th>
              <th className="px-1.5 py-1.5 text-right w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading && posts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  Loading posts...
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-muted-foreground">
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
                  onAskDirector={onAskDirector}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
