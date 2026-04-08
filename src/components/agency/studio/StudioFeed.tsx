'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { StudioFeedCard } from './StudioFeedCard'
import { PostDetailPanel } from './PostDetailPanel'
import type { ScheduledPost, PostPlatform, Output } from '@/types/database'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StudioItem {
  id: string
  type: 'post' | 'output'
  title: string
  caption: string
  platform?: PostPlatform
  hashtags?: string[]
  status?: string // draft, scheduled, published, failed, cancelled
  scheduledAt?: string
  createdAt: string
  thumbnailUrl?: string
  outputType?: string
  raw: ScheduledPost | Output
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONTENT_OUTPUT_TYPES = new Set([
  'social_post',
  'video',
  'video_script',
  'scheduled_post',
  'blog_article',
  'ad_copy',
  'email_sequence',
  'strategy_doc',
  'carousel',
  'other',
])

const HIDDEN_STATUSES = new Set(['cancelled', 'failed'])

function normaliseScheduledPost(post: ScheduledPost): StudioItem {
  const postType = post.post_type ?? 'single'
  const mediaCount = post.media_item_ids?.length ?? 0
  const typeLabel = postType === 'carousel' && mediaCount > 1
    ? `${post.platform} carousel (${mediaCount})`
    : `${post.platform} ${postType}`
  return {
    id: `post-${post.id}`,
    type: 'post',
    title: typeLabel,
    caption: post.caption,
    platform: post.platform,
    hashtags: post.hashtags,
    status: post.status,
    scheduledAt: post.scheduled_at,
    createdAt: post.created_at,
    raw: post,
  }
}

function normaliseOutput(output: Output): StudioItem {
  const meta = output.metadata as Record<string, unknown> | undefined
  return {
    id: `output-${output.id}`,
    type: 'output',
    title: output.title,
    caption:
      output.content.length > 280
        ? `${output.content.slice(0, 277)}...`
        : output.content,
    platform: (meta?.platform as PostPlatform) ?? undefined,
    hashtags: (meta?.hashtags as string[]) ?? undefined,
    status: output.is_approved ? 'approved' : 'draft',
    createdAt: output.created_at,
    thumbnailUrl: (meta?.thumbnail_url as string) ?? undefined,
    outputType: output.output_type,
    raw: output,
  }
}

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOfWeek = new Date(startOfToday)
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())

  if (date >= startOfToday) return 'Today'
  if (date >= startOfYesterday) return 'Yesterday'
  if (date >= startOfWeek) return 'This Week'
  return 'Earlier'
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Earlier']

function groupItems(items: StudioItem[]): Map<string, StudioItem[]> {
  const groups = new Map<string, StudioItem[]>()

  for (const item of items) {
    const sortDate = item.scheduledAt ?? item.createdAt
    const group = getDateGroup(sortDate)
    const existing = groups.get(group)
    if (existing) {
      existing.push(item)
    } else {
      groups.set(group, [item])
    }
  }

  // Return in defined order
  const ordered = new Map<string, StudioItem[]>()
  for (const key of GROUP_ORDER) {
    const g = groups.get(key)
    if (g && g.length > 0) {
      ordered.set(key, g)
    }
  }
  return ordered
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StudioFeed() {
  const { activeBrandId } = useAgencyStore()
  const [items, setItems] = useState<StudioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<StudioItem | null>(null)

  const fetchPosts = useCallback(async (): Promise<StudioItem[]> => {
    if (!activeBrandId) return []
    try {
      const res = await fetch(
        `/api/scheduled-posts?brandId=${activeBrandId}`
      )
      if (!res.ok) return []
      const data: ScheduledPost[] = await res.json()
      return data
        .filter(p => !HIDDEN_STATUSES.has(p.status))
        .map(normaliseScheduledPost)
    } catch {
      return []
    }
  }, [activeBrandId])

  const fetchOutputs = useCallback(async (): Promise<StudioItem[]> => {
    if (!activeBrandId) return []
    try {
      const res = await fetch(`/api/outputs?brandId=${activeBrandId}`)
      if (!res.ok) return []
      const data: Output[] = await res.json()
      return data
        .filter((o) => CONTENT_OUTPUT_TYPES.has(o.output_type))
        .map(normaliseOutput)
    } catch {
      return []
    }
  }, [activeBrandId])

  const refetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [posts, outputs] = await Promise.all([fetchPosts(), fetchOutputs()])
      const merged = [...posts, ...outputs].sort((a, b) => {
        const dateA = a.scheduledAt ?? a.createdAt
        const dateB = b.scheduledAt ?? b.createdAt
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      setItems(merged)
    } finally {
      setLoading(false)
    }
  }, [fetchPosts, fetchOutputs])

  useEffect(() => {
    refetchAll()
  }, [refetchAll])

  // ── No brand selected ────────────────────────────────────────────────────

  if (!activeBrandId) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <p className="text-muted-foreground text-sm">
          Select a brand to see your content.
        </p>
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <p className="text-muted-foreground text-sm">Loading content...</p>
      </div>
    )
  }

  // ── Empty ────────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <div className="bg-muted/50 rounded-xl border p-8 text-center">
          <p className="text-muted-foreground text-sm">
            No content yet. Go to the Create tab to get started.
          </p>
        </div>
      </div>
    )
  }

  // ── Feed with optional detail panel ──────────────────────────────────────

  const grouped = groupItems(items)

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Feed */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {Array.from(grouped.entries()).map(([group, groupItems]) => (
          <section key={group}>
            <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
              {group}
            </h3>
            <div className="space-y-3">
              {groupItems.map((item) => (
                <StudioFeedCard
                  key={item.id}
                  item={item}
                  isSelected={selectedItem?.id === item.id}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <PostDetailPanel
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdated={refetchAll}
        />
      )}
    </div>
  )
}
