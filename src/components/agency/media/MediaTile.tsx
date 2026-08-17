'use client'

import { useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { mediaTileUrl } from '@/lib/media/tile-preview'

/**
 * List tile. Loads thumbnail_url, then an image file_url. Decode failure
 * (D29) shows a placeholder — never a video file as the tile.
 */
export function MediaTile({
  fileType,
  fileUrl,
  thumbnailUrl,
  className = 'h-full w-full object-cover',
}: {
  fileType?: string | null
  fileUrl?: string | null
  thumbnailUrl?: string | null
  className?: string
}) {
  const [decodeFailed, setDecodeFailed] = useState(false)
  const url = mediaTileUrl({
    file_type: fileType,
    file_url: fileUrl,
    thumbnail_url: thumbnailUrl,
  })

  if (decodeFailed || !url) {
    return (
      <span className="flex h-full w-full items-center justify-center">
        <ImageIcon className="h-5 w-5 text-muted-foreground/50" aria-hidden />
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setDecodeFailed(true)}
    />
  )
}
