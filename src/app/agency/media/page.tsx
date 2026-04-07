'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAgencyStore } from '@/stores/agency-store'
import { MediaUploader } from '@/components/agency/MediaUploader'
import { MediaCard } from '@/components/agency/MediaCard'
import type { MediaItem } from '@/types/database'

export default function MediaPage() {
  const { activeBrandId, setAgent, setPendingReviewMessage } = useAgencyStore()
  const router = useRouter()
  const [mediaItems, setMediaItems] = useState<(MediaItem & { brands?: { name: string; slug: string } })[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMedia = useCallback(async () => {
    setLoading(true)
    const params = activeBrandId ? `?brandId=${activeBrandId}` : ''
    const res = await fetch(`/api/media${params}`)
    if (res.ok) {
      const data = await res.json()
      setMediaItems(data)
    }
    setLoading(false)
  }, [activeBrandId])

  useEffect(() => { fetchMedia() }, [fetchMedia])

  const handleGenerate = async (mediaItemId: string) => {
    const res = await fetch(`/api/media/${mediaItemId}/generate`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      alert(`Generated ${data.scheduledPosts?.length ?? 0} platform variants! Check the Outputs library.`)
    } else {
      const err = await res.json()
      alert(`Error: ${err.error}`)
    }
  }

  const handleDelete = async (mediaItemId: string) => {
    const res = await fetch(`/api/media?id=${mediaItemId}`, { method: 'DELETE' })
    if (res.ok) {
      setMediaItems(prev => prev.filter(m => m.id !== mediaItemId))
    }
  }

  const handleRepurpose = (mediaItemId: string) => {
    setAgent('overall')
    setPendingReviewMessage(
      `Repurpose media item ${mediaItemId} into clips, quotes, blog, newsletter, and social posts`
    )
  }

  if (!activeBrandId) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Select a brand first to manage media.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Media Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload images, videos, and audio. Images are saved to your brand library. Videos get AI transcription and platform-specific captions.
        </p>
      </div>

      <MediaUploader brandId={activeBrandId} onUploadComplete={fetchMedia} />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading media...</p>
      ) : mediaItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">No media uploaded yet. Drop some videos above to get started.</p>
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
