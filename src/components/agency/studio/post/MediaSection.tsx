'use client'

import { Upload, ImageIcon, Sparkles } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import { MediaSelector } from './MediaSelector'
import type { ContentType } from './ContentTypeSection'

const SLOT_CONFIG: Record<ContentType, { label: string; maxCount: number; acceptTypes: string[]; required: boolean }> = {
  post: { label: 'Image (optional)', maxCount: 1, acceptTypes: ['image'], required: false },
  carousel: { label: 'Carousel slides (2-10 images)', maxCount: 10, acceptTypes: ['image'], required: true },
  short_video: { label: 'Video (9:16, under 90s)', maxCount: 1, acceptTypes: ['video'], required: true },
  long_video: { label: 'Video (16:9, 1-60 min)', maxCount: 1, acceptTypes: ['video'], required: true },
  story: { label: 'Image or video (9:16)', maxCount: 1, acceptTypes: ['image', 'video'], required: false },
  ad: { label: 'Ad creative (image or video)', maxCount: 1, acceptTypes: ['image', 'video'], required: true },
}

interface MediaSectionProps {
  contentType: ContentType
  brandId: string
  selectedMediaIds: string[]
  onChange: (ids: string[]) => void
}

export function MediaSection({ contentType, brandId, selectedMediaIds, onChange }: MediaSectionProps) {
  const config = SLOT_CONFIG[contentType]

  const handleGenerateImage = () => {
    sendToDirector('Generate an image for my next social media post. Make it eye-catching and on-brand.')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Media</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{config.label}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {selectedMediaIds.length} / {config.maxCount} selected
        </span>
      </div>

      <MediaSelector
        brandId={brandId}
        selectedIds={selectedMediaIds}
        onChange={onChange}
        maxCount={config.maxCount}
        acceptTypes={config.acceptTypes}
      />

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleGenerateImage}
          className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate Image
        </button>
      </div>
    </div>
  )
}
