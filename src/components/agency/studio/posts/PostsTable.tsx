'use client'

import { useEffect, useState } from 'react'
import { MoreHorizontal, Pencil, Copy, CalendarClock, Sparkles, Trash2 } from 'lucide-react'
import { MediaTile } from '@/components/agency/media/MediaTile'
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
  type PlatformKey,
  type PostStatusKey,
} from '@/lib/mixpost/ui-tokens'
import type { ScheduledPost, MediaItem } from '@/types/database'
import { ownerReceiptLine, type PublisherRunReceipt } from '@/lib/publishers/receipts'

type PostWithReceipts = ScheduledPost & { receipts?: PublisherRunReceipt[] }

interface PostsTableProps {
  posts: PostWithReceipts[]
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

/** Platform initials for the coloured circle badges. */
const PLATFORM_INITIAL: Record<string, string> = {
  instagram: 'IG',
  facebook: 'FB',
  linkedin: 'Li',
  twitter: 'X',
  tiktok: 'TT',
  youtube: 'YT',
}

/**
 * Plain English status labels (AU style). Status = word + dot; never
 * colour alone. These describe what is happening in the owner's language.
 */
const STATUS_LABEL: Record<string, string> = {
  draft:      'Draft',
  scheduled:  'Waiting to go out',
  publishing: 'Sending',
  published:  'Gone out',
  failed:     'Did not go out',
  cancelled:  'Deleted',
}

/**
 * Each status maps to its design token so the dot colour matches the
 * status tab strip in PostsIndex. Uses the --st-* CSS variables defined in
 * globals.css; falls back to a neutral grey when the token isn't set.
 */
const STATUS_DOT_VAR: Record<string, string> = {
  draft:      'var(--st-draft,   oklch(0.62 0.012 240))',
  scheduled:  'var(--st-sched,   oklch(0.62 0.10 220))',
  publishing: 'var(--st-sending, oklch(0.72 0.15 70))',
  published:  'var(--st-pub,     oklch(0.58 0.14 152))',
  failed:     'var(--st-fail,    oklch(0.58 0.17 27))',
  cancelled:  'var(--st-draft,   oklch(0.62 0.012 240))',
}

/** Format a date+time in Australian locale (DD Mon YYYY, HH:MM). */
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

/* ── Thumbnail hook ──────────────────────────────────────────────────────── */

interface MediaCacheEntry {
  url: string | null
  fileUrl: string | null
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
          url: item.thumbnail_url ?? null,
          fileUrl: item.file_url ?? null,
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

/* ── Status chip — word + dot ────────────────────────────────────────────── */

function StatusChip({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status
  const dotColour = STATUS_DOT_VAR[status] ?? STATUS_DOT_VAR.draft

  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: dotColour }}
      />
      <span className="text-[13px] leading-tight text-foreground">{label}</span>
    </div>
  )
}

/* ── Platform mini-cluster — stacked coloured circles ────────────────────── */

/** Renders the platform badge for the post's single `platform` field. */
function PlatformBadge({ platform }: { platform: string }) {
  const colour = PLATFORM_BRAND_COLOURS[platform as PlatformKey] ?? 'oklch(0.55 0 0)'
  const initial = PLATFORM_INITIAL[platform] ?? platform.slice(0, 2).toUpperCase()
  return (
    <span
      className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ backgroundColor: colour }}
      title={platform}
    >
      {initial}
    </span>
  )
}

/* ── Post row ────────────────────────────────────────────────────────────── */

function PostRow(props: {
  post: PostWithReceipts
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

  // The "when" line: scheduled_at if future/pending, published_at if gone out.
  const dateLabel = post.status === 'published'
    ? `Published ${formatDateTime(post.published_at)}`
    : post.scheduled_at
      ? `Scheduled ${formatDateTime(post.scheduled_at)}`
      : null

  const caption = post.caption?.trim() ?? ''

  return (
    <tr
      className="group border-b border-border/40 transition-colors hover:bg-muted/25"
    >
      {/* Checkbox */}
      <td className="w-10 px-3 py-3 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(post.id)}
          aria-label={`Select post ${post.id.slice(0, 8)}`}
          className="mt-0.5 h-[18px] w-[18px] rounded-[5px] border-border"
          style={{ accentColor: 'var(--brand-deep, currentColor)' }}
        />
      </td>

      {/* Thumbnail — 52×52, clickable to edit */}
      <td className="w-[68px] px-2 py-3 align-top">
        <button
          type="button"
          onClick={() => onEdit(post.id)}
          aria-label="Open post"
          className="block h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[7px] border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MediaTile
            fileType={thumb?.type}
            fileUrl={thumb?.fileUrl}
            thumbnailUrl={thumb?.url}
          />
        </button>
      </td>

      {/* Caption + status + when — the primary data cell, click to edit */}
      <td className="min-w-0 px-2 py-3 align-top">
        <button
          type="button"
          onClick={() => onEdit(post.id)}
          className="block w-full text-left focus-visible:outline-none"
        >
          {caption ? (
            <p className="line-clamp-3 max-w-lg text-[13.5px] leading-[1.5] text-foreground">
              {caption}
            </p>
          ) : (
            <p className="text-[13px] italic text-muted-foreground">(no caption yet)</p>
          )}
          {post.hashtags?.length > 0 && (
            <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-muted-foreground">
              {post.hashtags.slice(0, 5).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
            </p>
          )}
          <div className="mt-1.5">
            <StatusChip status={post.status} />
          </div>
          {dateLabel && (
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{dateLabel}</p>
          )}
          {(post.receipts ?? []).length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {(post.receipts ?? []).map((run) => (
                <li key={`${run.account_id}-${run.created_at}`} className="text-[11.5px] text-muted-foreground">
                  {run.external_permalink ? (
                    <a
                      href={run.external_permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-2 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ownerReceiptLine(run)}
                    </a>
                  ) : (
                    ownerReceiptLine(run)
                  )}
                </li>
              ))}
            </ul>
          )}
        </button>
      </td>

      {/* Platform badge */}
      <td className="w-14 px-2 py-3 align-top">
        <PlatformBadge platform={post.platform} />
      </td>

      {/* Row actions */}
      <td className="w-10 px-2 py-3 align-top text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(triggerProps) => (
              <Button
                {...triggerProps}
                variant="ghost"
                size="icon-sm"
                aria-label="Open row actions"
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <MoreHorizontal />
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => onEdit(post.id)}>
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(post.id)}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReschedule(post.id)}>
              <CalendarClock className="mr-2 h-3.5 w-3.5" />
              Reschedule
            </DropdownMenuItem>
            {onAskDirector && (
              <DropdownMenuItem onClick={() => onAskDirector(post.id)}>
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Ask Director
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(post.id)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              Cancel post
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}

/* ── Posts table ─────────────────────────────────────────────────────────── */

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
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-2.5 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected
                  }}
                  onChange={() => onToggleSelectAll(posts.map((p) => p.id))}
                  aria-label="Select all rows"
                  className="h-[18px] w-[18px] rounded-[5px] border-border"
                  style={{ accentColor: 'var(--brand-deep, currentColor)' }}
                />
              </th>
              <th className="w-[68px] px-2 py-2.5 text-left">Media</th>
              <th className="px-2 py-2.5 text-left">Post</th>
              <th className="w-14 px-2 py-2.5 text-left">Acct</th>
              <th className="w-10 px-2 py-2.5 text-right" />
            </tr>
          </thead>
          <tbody>
            {loading && posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-[13px] text-muted-foreground">
                  Loading posts…
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-[13px] text-muted-foreground">
                  Nothing has gone out yet.
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
