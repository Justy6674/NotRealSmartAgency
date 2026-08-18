'use client'

import { Film, ImageIcon } from 'lucide-react'
import type { MediaSelectorItem as MediaItem } from './MediaSelector'
import type { ContentType } from './ContentTypeSection'

interface ComposeMediaStripProps {
  contentType: ContentType
  selectedMedia: MediaItem[]
  onReplace: () => void
  onChooseLibrary: () => void
  onRemove: (id: string) => void
  onUpload: () => void
}

function aspectLabel(contentType: ContentType): string {
  if (contentType === 'short_video' || contentType === 'story') return '9:16'
  if (contentType === 'long_video') return '16:9'
  if (contentType === 'carousel') return '1:1'
  return '4:5'
}

/**
 * Horizontal media strip — mockup `.mstrip`, not dashed slot grid.
 */
export function ComposeMediaStrip({
  contentType,
  selectedMedia,
  onReplace,
  onChooseLibrary,
  onRemove,
  onUpload,
}: ComposeMediaStripProps) {
  const primary = selectedMedia[0]

  if (!primary) {
    return (
      <ComposeDeskCardInline>
        <div className="flex flex-wrap items-center gap-3 py-[12px] px-[15px]">
          <span
            className="flex h-[68px] w-[54px] shrink-0 items-center justify-center rounded-[8px] border text-[10px]"
            style={{
              borderColor: 'var(--line)',
              background: 'linear-gradient(150deg, var(--brand-wash), var(--panel-2))',
              color: 'var(--ink-3)',
            }}
          >
            {aspectLabel(contentType)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
              Add a photo or video
            </p>
            <p className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
              Upload or pick from your library — then write the caption.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StripButton onClick={onUpload}>Upload</StripButton>
            <StripButton onClick={onChooseLibrary}>Choose from media library</StripButton>
          </div>
        </div>
      </ComposeDeskCardInline>
    )
  }

  const isVideo = primary.file_type?.startsWith('video')
  const thumb = isVideo ? primary.thumbnail_url : primary.file_url
  const kind = isVideo ? 'Video' : 'Photo'

  return (
    <ComposeDeskCardInline>
      <div className="flex flex-wrap items-center gap-3 py-[12px] px-[15px]">
        <span
          className="relative flex h-[68px] w-[54px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] border"
          style={{ borderColor: 'var(--line)' }}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt="" className="h-full w-full object-cover" />
          ) : isVideo ? (
            <Film className="h-5 w-5" style={{ color: 'var(--ink-3)' }} />
          ) : (
            <ImageIcon className="h-5 w-5" style={{ color: 'var(--ink-3)' }} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
            {primary.file_name}
          </p>
          <p className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            {kind}
            {selectedMedia.length > 1 ? ` · ${selectedMedia.length} items` : ''}
            {' · '}
            {aspectLabel(contentType)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StripButton onClick={onReplace}>Replace</StripButton>
          <StripButton onClick={onChooseLibrary}>Choose from media library</StripButton>
          <StripButton ghost onClick={() => onRemove(primary.id)}>
            Remove
          </StripButton>
        </div>
      </div>
    </ComposeDeskCardInline>
  )
}

function ComposeDeskCardInline({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[12px] border"
      style={{
        borderColor: 'var(--line, oklch(0.915 0.007 240))',
        background: 'var(--panel, oklch(1 0 0))',
        boxShadow:
          '0 1px 2px oklch(0.2 0.02 240 / 0.05), 0 8px 24px -16px oklch(0.2 0.02 240 / 0.28)',
      }}
    >
      {children}
    </div>
  )
}

function StripButton({
  children,
  onClick,
  ghost,
}: {
  children: React.ReactNode
  onClick: () => void
  ghost?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[8px] border px-[9px] py-[5px] text-[11.5px] font-semibold transition-colors duration-150"
      style={
        ghost
          ? {
              borderColor: 'transparent',
              background: 'transparent',
              color: 'var(--ink-2)',
            }
          : {
              borderColor: 'var(--line)',
              background: 'var(--panel)',
              color: 'var(--ink)',
            }
      }
    >
      {children}
    </button>
  )
}
