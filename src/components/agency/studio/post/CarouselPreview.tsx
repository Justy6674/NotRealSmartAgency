'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MediaItem {
  id: string
  file_url: string
  file_name: string
}

interface CarouselPreviewProps {
  mediaIds: string[]
  brandId: string
  caption: string
  brandName: string
}

export function CarouselPreview({
  mediaIds,
  brandId,
  caption,
  brandName,
}: CarouselPreviewProps) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [activeSlide, setActiveSlide] = useState(0)

  // Fetch media items for preview
  useEffect(() => {
    if (!mediaIds.length || !brandId) {
      setItems([])
      return
    }
    fetch(`/api/media?brandId=${brandId}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        const all: MediaItem[] = data.items ?? data ?? []
        // Preserve order from mediaIds
        const ordered = mediaIds
          .map((id) => all.find((m) => m.id === id))
          .filter(Boolean) as MediaItem[]
        setItems(ordered)
      })
      .catch(() => setItems([]))
  }, [mediaIds, brandId])

  // Reset slide when media changes
  useEffect(() => {
    setActiveSlide(0)
  }, [mediaIds.length])

  if (!items.length) {
    return (
      <div className="rounded-lg border border-border bg-muted p-6 text-center">
        <p className="text-xs text-muted-foreground/50">
          Select images to preview carousel
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-muted overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="w-6 h-6 rounded-full bg-muted-foreground/20" />
        <span className="text-xs font-medium text-foreground/80">
          {brandName}
        </span>
      </div>

      {/* Carousel image area */}
      <div className="relative aspect-square bg-[oklch(0.1_0.005_240)]">
        {items[activeSlide] && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={items[activeSlide].file_url}
            alt={items[activeSlide].file_name}
            className="w-full h-full object-cover"
          />
        )}

        {/* Nav arrows */}
        {activeSlide > 0 && (
          <button
            type="button"
            onClick={() => setActiveSlide((s) => s - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-white" />
          </button>
        )}
        {activeSlide < items.length - 1 && (
          <button
            type="button"
            onClick={() => setActiveSlide((s) => s + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-white" />
          </button>
        )}

        {/* Slide counter */}
        <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-0.5 text-[10px] font-medium text-white">
          {activeSlide + 1}/{items.length}
        </div>

        {/* Dot indicators */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveSlide(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === activeSlide
                  ? 'bg-white'
                  : 'bg-white/40'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-3 py-2">
          <p className="text-xs text-foreground/70 line-clamp-3">
            <span className="font-semibold text-foreground/90">{brandName}</span>{' '}
            {caption}
          </p>
        </div>
      )}
    </div>
  )
}
