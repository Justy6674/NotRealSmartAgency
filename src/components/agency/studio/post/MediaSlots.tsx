'use client'

import { ImageIcon, Film, Plus, X, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ContentType } from './ContentTypeSection'

/** Slot configuration per content type */
const SLOT_CONFIG: Record<ContentType, { min: number; max: number; accept: 'image' | 'video' | 'both'; required: boolean; aspect: string }> = {
  post:        { min: 0, max: 1,  accept: 'image', required: false, aspect: '1:1' },
  carousel:    { min: 2, max: 10, accept: 'image', required: true,  aspect: '1:1' },
  short_video: { min: 1, max: 1,  accept: 'video', required: true,  aspect: '9:16' },
  long_video:  { min: 1, max: 1,  accept: 'video', required: true,  aspect: '16:9' },
  story:       { min: 0, max: 1,  accept: 'both',  required: false, aspect: '9:16' },
  ad:          { min: 1, max: 1,  accept: 'both',  required: true,  aspect: '1:1' },
}

/**
 * Shared media shape — imported from MediaSelector so the picker, the slot
 * card, and the Creator all reference one type. See MediaSelector for the
 * Pick<MediaItemWithUsage> definition.
 */
import type { MediaSelectorItem as MediaItem } from './MediaSelector'

interface MediaSlotsProps {
  contentType: ContentType
  selectedMedia: MediaItem[]
  onRemove: (id: string) => void
  onAddClick: () => void
}

/** 180 → "3:00" */
function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 1) return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Render a media thumbnail correctly for images + videos.
 *
 * Videos use `thumbnail_url` (generated server-side by the shared pipeline)
 * with a play-triangle overlay and a duration pill. If the thumbnail hasn't
 * been generated yet (e.g. a freshly uploaded video whose process call is
 * still running), fall back to a Film icon placeholder. NEVER render a video
 * file_url as an <img src> — that was the old grey-box bug.
 */
function MediaThumb({ item }: { item: MediaItem }) {
  const isVideo = item.file_type?.startsWith('video')
  const src = isVideo ? item.thumbnail_url : item.file_url

  if (isVideo && !src) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-muted">
        <Film className="h-6 w-6 text-muted-foreground/60" />
      </div>
    )
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src!}
        alt={item.file_name}
        className="h-full w-full object-cover"
      />
      {isVideo && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-black/60 p-1.5">
              <Play className="h-3 w-3 text-white fill-white" />
            </div>
          </div>
          {item.duration_seconds ? (
            <div className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white tabular-nums">
              {formatDuration(item.duration_seconds)}
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

/**
 * Scent Sell-style dashed-border media upload slots.
 * Shows numbered slots based on content type with required/optional indicators.
 * Videos render their real thumbnail (via MediaThumb) instead of a grey icon.
 */
export function MediaSlots({ contentType, selectedMedia, onRemove, onAddClick }: MediaSlotsProps) {
  const config = SLOT_CONFIG[contentType]
  const filled = selectedMedia.length
  const slotsToShow = contentType === 'carousel'
    ? Math.max(config.min, Math.min(filled + 1, config.max))
    : config.max

  const isVideoContent = config.accept === 'video'
  const SlotIcon = isVideoContent ? Film : ImageIcon

  return (
    <div className="space-y-2">
      {/* Upload counter */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {config.accept === 'video' ? 'Video' : config.accept === 'both' ? 'Image or video' : 'Images'}
          {' '}&middot; {config.aspect}
        </span>
        <span className="text-xs text-muted-foreground font-medium">
          {filled} / {config.max} {contentType === 'carousel' ? 'slides' : 'selected'}
        </span>
      </div>

      {/* Slot grid */}
      <div className={cn(
        'grid gap-2',
        contentType === 'carousel' ? 'grid-cols-5 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-3'
      )}>
        {Array.from({ length: slotsToShow }).map((_, i) => {
          const media = selectedMedia[i]
          const isRequired = i < config.min || (config.required && i === 0)

          if (media) {
            // Filled slot — thumbnail with remove button
            return (
              <div
                key={media.id}
                className="relative aspect-square rounded-lg border-2 border-emerald-400/60 bg-emerald-400/5 overflow-hidden group"
              >
                <MediaThumb item={media} />
                {/* Slot number */}
                <span className="absolute top-1 left-1 z-10 h-5 w-5 rounded-full bg-foreground/80 text-background text-[10px] font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => onRemove(media.id)}
                  className="absolute top-1 right-1 z-10 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from post"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          }

          // Empty slot — dashed border
          return (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={onAddClick}
              className={cn(
                'aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all',
                isRequired
                  ? 'border-red-400/40 bg-red-400/5 hover:border-red-400/60 hover:bg-red-400/10'
                  : 'border-muted-foreground/20 bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
              )}
            >
              {i === filled ? (
                <Plus className="h-5 w-5 text-muted-foreground" />
              ) : (
                <SlotIcon className="h-5 w-5 text-muted-foreground/40" />
              )}
              <span className="text-[9px] text-muted-foreground font-medium">
                {isRequired ? 'Required' : 'Optional'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
