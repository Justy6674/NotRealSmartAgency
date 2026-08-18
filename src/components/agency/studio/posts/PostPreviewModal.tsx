'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PlatformMockupPreview } from '@/components/agency/studio/preview'
import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'
import { PostStatusChip } from './PostStatusDot'
import { LabelChip } from './PostLabelPicker'
import type { SocialPostRow } from '@/hooks/usePostsList'
import type { MediaItem } from '@/types/database'

/**
 * Clicking a row opens this, rather than navigating.
 *
 * Mixpost's list opens a preview on a row click and puts editing behind the
 * pencil, and it is right to: most clicks on a list of posts are "what did that
 * one say", not "let me change it". Navigating to a composer for that loses the
 * owner's place in a list they were scanning.
 *
 * Editing lives on the pencil and the row menu. Everything here is read-only.
 */

interface PostPreviewModalProps {
  post: SocialPostRow | null
  brandName: string
  onClose: () => void
  onEdit?: (id: string) => void
}

interface ActivityRow {
  id: string
  type: string
  body: string | null
  created_at: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formatWhen(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function PostPreviewModal({ post, brandName, onClose, onEdit }: PostPreviewModalProps) {
  const [tab, setTab] = useState<'preview' | 'activity'>('preview')
  const [media, setMedia] = useState<string[]>([])
  const [activity, setActivity] = useState<ActivityRow[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [platform, setPlatform] = useState<string | null>(null)

  const postId = post?.id ?? null
  const mediaIds = useMemo(() => post?.media_item_ids ?? [], [post])

  useEffect(() => {
    setTab('preview')
    setPlatform(post?.platforms[0] ?? null)
    setActivity(null)
  }, [postId, post?.platforms])

  // Desk rows point at media by id; history rows carry a picture straight from
  // the publisher and have nothing here to look up.
  useEffect(() => {
    if (!post) return
    if (post.origin === 'history') {
      setMedia(post.thumbnail_url ? [post.thumbnail_url] : [])
      return
    }
    if (mediaIds.length === 0) {
      setMedia([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/media?ids=${mediaIds.join(',')}`)
        if (!res.ok) return
        const data = (await res.json()) as MediaItem[] | { items?: MediaItem[] }
        const items = Array.isArray(data) ? data : data.items ?? []
        const byId = new Map(items.map((item) => [item.id, item]))
        const urls = mediaIds
          .map((id) => byId.get(id))
          .map((item) => item?.thumbnail_url ?? item?.file_url ?? null)
          .filter((url): url is string => typeof url === 'string')
        if (!cancelled) setMedia(urls)
      } catch {
        if (!cancelled) setMedia([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [post, mediaIds])

  useEffect(() => {
    if (tab !== 'activity' || !postId || !UUID.test(postId) || activity !== null) return
    let cancelled = false
    setActivityLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/post-activity?scheduled_post_id=${postId}&limit=50`)
        const data = res.ok ? await res.json() : []
        if (!cancelled) setActivity(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setActivity([])
      } finally {
        if (!cancelled) setActivityLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, postId, activity])

  if (!post) return null

  const when =
    post.status === 'published' || post.status === 'partial'
      ? formatWhen(post.published_at ?? post.scheduled_at)
      : formatWhen(post.scheduled_at)

  const activePlatform = platform ?? post.platforms[0] ?? post.platform ?? 'instagram'
  const canEdit = post.origin === 'desk'

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[86vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {post.origin === 'history' ? 'Published earlier' : 'Post preview'}
          </DialogTitle>
          <DialogDescription>
            {post.origin === 'history'
              ? 'This went out before it was connected here, so it can be read but not changed.'
              : 'How this looks where it lands.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <PostStatusChip status={post.status} when={when} />
          <div className="flex flex-wrap items-center gap-1.5">
            {post.labels.map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
          </div>
        </div>

        {post.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
            {post.error}
          </p>
        )}

        {/* Tabs — Activity is only meaningful for a post this desk made. */}
        <div className="flex items-center gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`px-3 py-2 text-[13px] font-medium ${
              tab === 'preview' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            style={tab === 'preview' ? { boxShadow: 'inset 0 -2px 0 0 var(--brand, currentColor)' } : undefined}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => canEdit && setTab('activity')}
            disabled={!canEdit}
            className={`px-3 py-2 text-[13px] font-medium disabled:opacity-40 ${
              tab === 'activity' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
            style={tab === 'activity' ? { boxShadow: 'inset 0 -2px 0 0 var(--brand, currentColor)' } : undefined}
          >
            Activity
          </button>
        </div>

        {tab === 'preview' ? (
          <div className="space-y-3">
            {post.platforms.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {post.platforms.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => setPlatform(entry)}
                    className="rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors"
                    style={
                      entry === activePlatform
                        ? {
                            background: 'var(--brand-wash, oklch(0.966 0.0068 240))',
                            color: 'var(--brand-deep, currentColor)',
                          }
                        : { background: 'var(--panel-2, transparent)', color: 'var(--ink-2, inherit)' }
                    }
                  >
                    {ownerFacingPlatformLabel(entry)}
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-center">
              <PlatformMockupPreview
                platform={activePlatform}
                caption={post.caption}
                hashtags={post.hashtags}
                mediaUrl={media[0]}
                mediaUrls={media}
                brandName={brandName}
              />
            </div>

            {post.accounts.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Accounts
                </p>
                <p className="mt-0.5 text-[12.5px] text-foreground">
                  {post.accounts.map((account) => account.name).join(' · ')}
                </p>
              </div>
            )}

            {post.permalinks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.permalinks.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground underline-offset-2 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    See it live
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {activityLoading && (
              <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading the history of this post…
              </p>
            )}
            {!activityLoading && (activity?.length ?? 0) === 0 && (
              <p className="text-[12.5px] text-muted-foreground">Nothing has happened to this post yet.</p>
            )}
            <ul className="space-y-2">
              {(activity ?? []).map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border bg-card px-3 py-2">
                  <p className="text-[12.5px] text-foreground">
                    {entry.body ?? entry.type.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                    {formatWhen(entry.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          {canEdit && onEdit && (
            <Button size="sm" onClick={() => onEdit(post.id)}>
              Open to edit
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
