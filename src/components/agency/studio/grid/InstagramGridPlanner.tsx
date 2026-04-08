'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Instagram, ImageIcon } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { sendToDirector } from '@/lib/chat-dispatch'
import { SortableImageGrid } from '../dnd/SortableImageGrid'
import type { ScheduledPost } from '@/types/database'

interface GridPost {
  id: string
  url: string  // media URL or placeholder
  name: string
  caption: string
  status: string
  scheduledAt: string | null
  mediaItemIds: string[]
}

export function InstagramGridPlanner() {
  const { activeBrandId } = useAgencyStore()
  const [posts, setPosts] = useState<GridPost[]>([])
  const [loading, setLoading] = useState(true)
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({}) // mediaId -> file_url
  const [brandName, setBrandName] = useState<string>('')

  // Fetch Instagram posts
  const fetchPosts = useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    try {
      // Fetch brand name for profile display
      fetch(`/api/studio/overview?brandId=${activeBrandId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.brand?.name) setBrandName(d.brand.name) })
        .catch(() => {})

      const res = await fetch(`/api/scheduled-posts?brandId=${activeBrandId}`)
      if (!res.ok) return
      const data: ScheduledPost[] = await res.json()

      // Filter to Instagram only, exclude cancelled
      const igPosts = data
        .filter(p => p.platform === 'instagram' && p.status !== 'cancelled')
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
        .slice(0, 30) // max 30 posts (10 rows)

      setPosts(igPosts.map(p => ({
        id: p.id,
        url: '', // filled from media fetch
        name: p.caption.slice(0, 50),
        caption: p.caption,
        status: p.status,
        scheduledAt: p.scheduled_at,
        mediaItemIds: p.media_item_ids ?? [],
      })))

      // Fetch media for these posts
      const allMediaIds = igPosts.flatMap(p => p.media_item_ids ?? []).filter(Boolean)
      if (allMediaIds.length > 0) {
        const mediaRes = await fetch(`/api/media?brandId=${activeBrandId}`)
        if (mediaRes.ok) {
          const mediaData = await mediaRes.json()
          const items = Array.isArray(mediaData) ? mediaData : mediaData.items ?? []
          const map: Record<string, string> = {}
          for (const item of items as { id: string; file_url: string }[]) {
            map[item.id] = item.file_url
          }
          setMediaMap(map)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  // Get first media URL for each post
  const gridItems = posts.map(p => ({
    id: p.id,
    url: p.mediaItemIds.length > 0 ? (mediaMap[p.mediaItemIds[0]] ?? '') : '',
    name: p.caption.slice(0, 50),
  }))

  const handleReorder = async (newItems: { id: string }[]) => {
    // Optimistic update
    const reordered = newItems.map(item => posts.find(p => p.id === item.id)!).filter(Boolean)
    setPosts(reordered)

    // TODO: Update scheduled_at times to maintain order
    // For now, visual-only reorder
  }

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">Select a brand to plan your Instagram grid.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      {/* Mock IG profile header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.55_0.15_300)] to-[oklch(0.55_0.15_30)]">
          <span className="text-xl font-bold text-white">{brandName?.charAt(0) ?? 'B'}</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Instagram className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Instagram Grid Planner</span>
          </div>
          <div className="flex gap-4 mt-1">
            <span className="text-xs text-muted-foreground"><strong className="text-foreground">{posts.length}</strong> posts</span>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading grid...</p>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-muted-foreground">No Instagram posts yet.</p>
          <p className="text-xs text-muted-foreground/70">Plan your Instagram grid by creating posts. Drag to reorder how your feed will look.</p>
          <button
            type="button"
            onClick={() => sendToDirector('Create an Instagram post for this brand')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[oklch(0.55_0.1_240)] px-4 py-2 text-xs font-medium text-white hover:bg-[oklch(0.50_0.1_240)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Create First Post
          </button>
        </div>
      ) : (
        <div>
          <p className="text-[10px] text-muted-foreground mb-2">
            Drag to reorder how your feed will look. Most recent posts appear first.
          </p>
          <SortableImageGrid
            items={gridItems}
            onReorder={handleReorder}
            renderItem={(item, index) => (
              <div className="relative aspect-square overflow-hidden rounded cursor-grab active:cursor-grabbing">
                {item.url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.url} alt="" className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <div className="h-full w-full bg-[oklch(0.12_0.005_240)] flex flex-col items-center justify-center gap-1">
                    <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                    <span className="text-[10px] text-muted-foreground/60 text-center px-1 line-clamp-2">
                      {item.name || 'Pending'}
                    </span>
                  </div>
                )}
                {/* Status overlay */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                  <span className={`text-[10px] font-medium ${
                    posts[index]?.status === 'published' ? 'text-green-400' :
                    posts[index]?.status === 'scheduled' ? 'text-blue-400' :
                    'text-zinc-400'
                  }`}>
                    {posts[index]?.status ?? ''}
                  </span>
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  )
}
