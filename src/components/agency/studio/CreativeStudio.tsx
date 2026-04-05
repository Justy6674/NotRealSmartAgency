'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { MediaUploader } from '@/components/agency/MediaUploader'
import { MediaCard } from '@/components/agency/MediaCard'
import { StudioDashboard } from './StudioDashboard'
import { ContentCalendar } from '@/components/agency/ContentCalendar'
import { EnhancedCalendar } from './EnhancedCalendar'
import { CalendarActions } from './CalendarActions'
import { CreateHub } from './CreateHub'
import type { MediaItem } from '@/types/database'

// ─── Tab definitions ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'all', label: 'All Content' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'media', label: 'Media' },
  { id: 'create', label: 'Create' },
] as const

type TabId = (typeof TABS)[number]['id']

// ─── Studio Media (inline wrapper) ───────────────────────────────────────────

function StudioMedia() {
  const { activeBrandId, setPendingReviewMessage } = useAgencyStore()
  const router = useRouter()
  const [mediaItems, setMediaItems] = useState<
    (MediaItem & { brands?: { name: string; slug: string } })[]
  >([])
  const [loading, setLoading] = useState(true)

  const fetchMedia = useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/media?brandId=${activeBrandId}`)
      if (res.ok) {
        const data = await res.json()
        setMediaItems(data)
      }
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  const handleGenerate = async (mediaItemId: string) => {
    const res = await fetch(`/api/media/${mediaItemId}/generate`, {
      method: 'POST',
    })
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

  const handleDelete = async (mediaItemId: string) => {
    const res = await fetch(`/api/media?id=${mediaItemId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setMediaItems((prev) => prev.filter((m) => m.id !== mediaItemId))
    }
  }

  const handleRepurpose = (mediaItemId: string) => {
    setPendingReviewMessage(
      `Repurpose media item ${mediaItemId} into clips, quotes, blog, newsletter, and social posts`
    )
  }

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground text-sm">
          Select a brand first to manage media.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto p-6">
      <MediaUploader brandId={activeBrandId} onUploadComplete={fetchMedia} />

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading media...</p>
      ) : mediaItems.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No media uploaded yet. Drop some videos above to get started.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mediaItems.map((item) => (
            <MediaCard
              key={item.id}
              mediaItem={item}
              onGenerate={handleGenerate}
              onDelete={handleDelete}
              onRepurpose={handleRepurpose}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Creative Studio ─────────────────────────────────────────────────────────

export function CreativeStudio() {
  const [activeTab, setActiveTab] = useState<TabId>('all')
  const { setChatPanelOpen } = useAgencyStore()

  // Auto-open chat panel so Director is always visible in the Studio
  useEffect(() => {
    setChatPanelOpen(true)
  }, [setChatPanelOpen])

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 px-6 pt-4 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'all' && <StudioDashboard />}
        {activeTab === 'calendar' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <CalendarActions />
            <EnhancedCalendar />
          </div>
        )}
        {activeTab === 'media' && <StudioMedia />}
        {activeTab === 'create' && <CreateHub />}
      </div>
    </div>
  )
}
