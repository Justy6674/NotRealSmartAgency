'use client'

import { useEffect, useState } from 'react'
import {
  MoreHorizontal,
  Pencil,
  Copy,
  CalendarClock,
  ListPlus,
  Sparkles,
  Trash2,
  RotateCcw,
  Eye,
} from 'lucide-react'
import { MediaTile } from '@/components/agency/media/MediaTile'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { PLATFORM_BRAND_COLOURS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'
import type { MediaItem } from '@/types/database'
import { ownerReceiptLine } from '@/lib/publishers/receipts'
import { PostStatusChip } from './PostStatusDot'
import { PlatformGlyph, isPostablePlatform } from './PlatformGlyph'
import { LabelChip, PostLabelPicker } from './PostLabelPicker'
import type { PostLabel } from '@/lib/posts/post-labels'
import type { SocialPostRow } from '@/hooks/usePostsList'

/**
 * Seven columns, the way Mixpost has them:
 *
 *   select · Status · Content · Media · Labels · Accounts · actions
 *
 * The two NRS was missing were Labels, which had no surface anywhere in the
 * app, and Accounts, which showed one coloured initial for a `platform` string
 * rather than the accounts a post actually went to — fine while every post went
 * to exactly one account, and wrong the moment one goes to two.
 *
 * Clicking Status, Content, Media or Labels opens the preview. Editing is the
 * pencil, so a stray click on a list never lands you in a composer.
 */

interface PostsTableProps {
  posts: SocialPostRow[]
  selectedIds: Set<string>
  labels: PostLabel[]
  onToggleSelect: (id: string) => void
  onToggleSelectAll: (ids: string[]) => void
  onPreview: (post: SocialPostRow) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onReschedule: (post: SocialPostRow) => void
  onRetry: (post: SocialPostRow) => void
  onDelete: (post: SocialPostRow) => void
  /**
   * Mixpost's fourth leave-mode. Undefined when this business has no posting
   * times set — offering a queue with nowhere to put things is the promise
   * this desk has already been caught making once.
   */
  onAddToQueue?: (post: SocialPostRow) => void
  onSetLabels: (postId: string, labelIds: string[]) => void
  onCreateLabel: (name: string, colour: string) => Promise<PostLabel | null>
  onAskDirector?: (id: string) => void
  loading: boolean
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

/* ── Thumbnail lookup ────────────────────────────────────────────────────── */

interface MediaCacheEntry {
  url: string | null
  fileUrl: string | null
  type: string | null
}

const mediaCache = new Map<string, MediaCacheEntry>()

function useMediaThumb(mediaId: string | null) {
  const [entry, setEntry] = useState<MediaCacheEntry | null>(
    mediaId ? mediaCache.get(mediaId) ?? null : null,
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
        /* a missing thumbnail is a blank tile, not a broken row */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mediaId])

  return entry
}

/* ── Accounts cell ───────────────────────────────────────────────────────── */

/**
 * A disc in the network's colour carrying the network's own mark.
 *
 * It used to carry two letters, so an owner scanning a list read `IN`, `FA`,
 * `LI` and had to translate. The mark is the thing Mixpost puts here and the
 * thing every one of these platforms trains its own users to recognise. The
 * lettered fallback survives inside `PlatformGlyph` for the networks we have no
 * mark for — an initial in the right colour is honest, a borrowed icon is not.
 */
function AccountAvatar({ platform, title }: { platform: string; title: string }) {
  const colour = PLATFORM_BRAND_COLOURS[platform as PlatformKey] ?? 'oklch(0.55 0 0)'
  return (
    <span
      className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-card text-white"
      style={{ backgroundColor: colour }}
      title={title}
    >
      <PlatformGlyph platform={platform} size={13} tinted={false} />
    </span>
  )
}

function AccountsCell({ post, onPreview }: { post: SocialPostRow; onPreview: () => void }) {
  // A post with accounts names them. One with only a platform (a desk row that
  // has not gone out yet, so no account has been picked) shows the platform,
  // which is all that is actually known.
  const entries = (
    post.accounts.length > 0
      ? post.accounts.map((account) => ({
          key: account.id,
          platform: account.platform,
          title: `${account.name} · ${ownerFacingPlatformLabel(account.platform)}`,
        }))
      : post.platforms.map((platform) => ({
          key: platform,
          platform,
          title: ownerFacingPlatformLabel(platform),
        }))
  ).filter((entry) => isPostablePlatform(entry.platform))

  const shown = entries.slice(0, 3)
  const rest = entries.slice(3)

  if (entries.length === 0) return <span className="text-[12px] text-muted-foreground">—</span>

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={onPreview}
        aria-label="Open this post"
        className="flex items-center -space-x-2"
      >
        {shown.map((entry) => (
          <AccountAvatar key={entry.key} platform={entry.platform} title={entry.title} />
        ))}
      </button>
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(triggerProps) => (
              <button
                {...triggerProps}
                type="button"
                className="ml-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground hover:text-foreground"
              >
                +{rest.length}
              </button>
            )}
          />
          <DropdownMenuContent align="end" className="w-64">
            {rest.map((entry) => (
              <DropdownMenuItem key={entry.key} closeOnClick={false}>
                <span className="truncate">{entry.title}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

/* ── Row ─────────────────────────────────────────────────────────────────── */

function PostRow(props: {
  post: SocialPostRow
  selected: boolean
  labels: PostLabel[]
  onToggleSelect: (id: string) => void
  onPreview: (post: SocialPostRow) => void
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onReschedule: (post: SocialPostRow) => void
  onRetry: (post: SocialPostRow) => void
  onDelete: (post: SocialPostRow) => void
  onAddToQueue?: (post: SocialPostRow) => void
  onSetLabels: (postId: string, labelIds: string[]) => void
  onCreateLabel: (name: string, colour: string) => Promise<PostLabel | null>
  onAskDirector?: (id: string) => void
}) {
  const {
    post,
    selected,
    labels,
    onToggleSelect,
    onPreview,
    onEdit,
    onDuplicate,
    onReschedule,
    onRetry,
    onDelete,
    onAddToQueue,
    onSetLabels,
    onCreateLabel,
    onAskDirector,
  } = props

  const firstMediaId = post.media_item_ids[0] ?? null
  const thumb = useMediaThumb(post.origin === 'desk' ? firstMediaId : null)
  const historyThumb = post.origin === 'history' ? post.thumbnail_url : null

  const editable = post.origin === 'desk'
  const canRetry = post.status === 'failed' || post.status === 'partial'
  // Only a draft. Anything already on its way has a time of its own, and
  // handing it to the queue as well is how one post goes out twice.
  const canQueue = editable && post.status === 'draft'
  const queuedAt = typeof post.metadata?.queued_at === 'string' ? post.metadata.queued_at : null

  const when =
    post.status === 'published' || post.status === 'partial'
      ? `Gone out ${formatDateTime(post.published_at ?? post.scheduled_at)}`
      : post.scheduled_at
        ? `${formatDateTime(post.scheduled_at)}`
        : null

  const caption = post.caption.trim()
  const openPreview = () => onPreview(post)

  return (
    <tr className="group border-b border-border/40 transition-colors hover:bg-muted/25">
      {/* select */}
      <td className="w-10 px-3 py-3 align-top">
        <input
          type="checkbox"
          checked={selected}
          disabled={!editable}
          onChange={() => onToggleSelect(post.id)}
          aria-label={`Select post ${post.id.slice(0, 8)}`}
          className="mt-0.5 h-[18px] w-[18px] rounded-[5px] border-border disabled:opacity-30"
          style={{ accentColor: 'var(--brand-deep, currentColor)' }}
          title={editable ? undefined : 'Published before it was connected here, so it cannot be changed'}
        />
      </td>

      {/* Status */}
      <td className="w-44 cursor-pointer px-2 py-3 align-top" onClick={openPreview}>
        <PostStatusChip status={post.status} when={when} />
        {/* A queued post sits with the publisher until a free time comes round,
            which can be days. "Sending" on its own would read as stuck. */}
        {queuedAt && post.status === 'publishing' && (
          <p className="mt-0.5 pl-[18px] text-[11.5px] leading-tight text-muted-foreground">
            In the queue, waiting for the next free time
          </p>
        )}
      </td>

      {/* Content */}
      <td className="min-w-0 cursor-pointer px-2 py-3 align-top" onClick={openPreview}>
        {caption ? (
          <p className="line-clamp-3 max-w-lg text-[13.5px] leading-[1.5] break-words text-foreground">
            {caption}
          </p>
        ) : (
          <p className="text-[13px] italic text-muted-foreground">(nothing written yet)</p>
        )}
        {post.hashtags.length > 0 && (
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-muted-foreground">
            {post.hashtags.slice(0, 5).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')}
          </p>
        )}
        {post.receipts.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {post.receipts.map((run) => (
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
      </td>

      {/* Media — one tile plus a +N badge, exactly Mixpost's shape */}
      <td className="w-24 cursor-pointer px-2 py-3 align-top" onClick={openPreview}>
        {post.media_count > 0 || historyThumb ? (
          <span className="relative inline-block">
            <span className="block h-[52px] w-[52px] overflow-hidden rounded-[7px] border border-border bg-muted">
              <MediaTile
                fileType={thumb?.type ?? (historyThumb ? 'image/jpeg' : null)}
                fileUrl={thumb?.fileUrl ?? historyThumb}
                thumbnailUrl={thumb?.url ?? historyThumb}
              />
            </span>
            {post.media_count > 1 && (
              <span className="absolute -right-2 top-0 rounded-full border border-border bg-card px-1.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                +{post.media_count - 1}
              </span>
            )}
          </span>
        ) : (
          <span className="text-[12px] text-muted-foreground">—</span>
        )}
      </td>

      {/* Labels */}
      <td className="w-48 px-2 py-3 align-top">
        {editable ? (
          <div className="flex flex-wrap items-center gap-1">
            {post.labels.map((label) => (
              <LabelChip
                key={label.id}
                label={label}
                onRemove={() =>
                  onSetLabels(
                    post.id,
                    post.labels.filter((entry) => entry.id !== label.id).map((entry) => entry.id),
                  )
                }
              />
            ))}
            <PostLabelPicker
              available={labels}
              selectedIds={post.labels.map((label) => label.id)}
              onChange={(ids) => onSetLabels(post.id, ids)}
              onCreate={onCreateLabel}
              triggerLabel={post.labels.length === 0 ? 'Add' : '+'}
            />
          </div>
        ) : (
          <span className="text-[12px] text-muted-foreground">—</span>
        )}
      </td>

      {/* Accounts */}
      <td className="w-32 px-2 py-3 align-top">
        <AccountsCell post={post} onPreview={openPreview} />
      </td>

      {/* Actions */}
      <td className="w-20 px-2 py-3 align-top text-right">
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={editable ? 'Edit this post' : 'Look at this post'}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            onClick={() => (editable ? onEdit(post.id) : openPreview())}
          >
            {editable ? <Pencil /> : <Eye />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={(triggerProps) => (
                <Button
                  {...triggerProps}
                  variant="ghost"
                  size="icon-sm"
                  aria-label="More for this post"
                  // Always visible on a phone. Hover-to-reveal is a mouse
                  // gesture, and on a touch screen it hid every row action —
                  // edit, queue, delete — behind a gesture the device has no
                  // way to make. It fades in on a pointer device as before.
                  className="opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <MoreHorizontal />
                </Button>
              )}
            />
            <DropdownMenuContent align="end" className="w-52">
              {editable && (
                <DropdownMenuItem onClick={() => onEdit(post.id)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" />
                  Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onDuplicate(post.id)}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Make a copy
              </DropdownMenuItem>
              {editable && (
                <DropdownMenuItem onClick={() => onReschedule(post)}>
                  <CalendarClock className="mr-2 h-3.5 w-3.5" />
                  Change the time
                </DropdownMenuItem>
              )}
              {onAddToQueue && canQueue && (
                <DropdownMenuItem onClick={() => onAddToQueue(post)}>
                  <ListPlus className="mr-2 h-3.5 w-3.5" />
                  Add to the queue
                </DropdownMenuItem>
              )}
              {canRetry && (
                <DropdownMenuItem onClick={() => onRetry(post)}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  Try sending again
                </DropdownMenuItem>
              )}
              {onAskDirector && (
                <DropdownMenuItem onClick={() => onAskDirector(post.id)}>
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Ask about this post
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => onDelete(post)}>
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  )
}

/* ── Table ───────────────────────────────────────────────────────────────── */

export function PostsTable(props: PostsTableProps) {
  const {
    posts,
    selectedIds,
    labels,
    onToggleSelect,
    onToggleSelectAll,
    onPreview,
    onEdit,
    onDuplicate,
    onReschedule,
    onRetry,
    onDelete,
    onAddToQueue,
    onSetLabels,
    onCreateLabel,
    onAskDirector,
    loading,
  } = props

  const selectable = posts.filter((post) => post.origin === 'desk')
  const allSelected = selectable.length > 0 && selectable.every((p) => selectedIds.has(p.id))
  const someSelected = selectable.some((p) => selectedIds.has(p.id))

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
                  onChange={() => onToggleSelectAll(selectable.map((p) => p.id))}
                  aria-label="Select every post on this page"
                  className="h-[18px] w-[18px] rounded-[5px] border-border"
                  style={{ accentColor: 'var(--brand-deep, currentColor)' }}
                />
              </th>
              <th className="w-44 px-2 py-2.5 text-left">Status</th>
              <th className="px-2 py-2.5 text-left">What it says</th>
              <th className="w-24 px-2 py-2.5 text-left">Picture</th>
              <th className="w-48 px-2 py-2.5 text-left">Labels</th>
              <th className="w-32 px-2 py-2.5 text-left">Accounts</th>
              <th className="w-20 px-2 py-2.5 text-right" />
            </tr>
          </thead>
          <tbody>
            {loading && posts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-[13px] text-muted-foreground">
                  Loading your posts…
                </td>
              </tr>
            ) : posts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-[13px] text-muted-foreground">
                  No posts found.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <PostRow
                  key={`${post.origin}-${post.id}`}
                  post={post}
                  selected={selectedIds.has(post.id)}
                  labels={labels}
                  onToggleSelect={onToggleSelect}
                  onPreview={onPreview}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                  onReschedule={onReschedule}
                  onRetry={onRetry}
                  onDelete={onDelete}
                  onAddToQueue={onAddToQueue}
                  onSetLabels={onSetLabels}
                  onCreateLabel={onCreateLabel}
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
