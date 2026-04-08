'use client'

import { Images, Film, FolderOpen, Archive, Trash2 } from 'lucide-react'
import type { MediaCollection } from '@/types/database'

interface CollectionCardProps {
  collection: MediaCollection & {
    media_collection_items?: { id: string; media_items?: { file_url: string; file_name: string } | null }[]
  }
  onClick: (id: string) => void
  onArchive?: (id: string) => void
  onDelete?: (id: string) => void
}

const TYPE_ICONS: Record<string, typeof Images> = {
  carousel: Images,
  campaign: FolderOpen,
  album: FolderOpen,
  story_set: Film,
}

export function CollectionCard({ collection, onClick, onArchive, onDelete }: CollectionCardProps) {
  const items = collection.media_collection_items ?? []
  const Icon = TYPE_ICONS[collection.collection_type] ?? FolderOpen
  const previewImages = items
    .slice(0, 4)
    .map(i => i.media_items?.file_url)
    .filter(Boolean) as string[]

  return (
    <div
      className="group relative cursor-pointer rounded-lg border border-border bg-card overflow-hidden hover:border-primary/40 transition-colors"
      onClick={() => onClick(collection.id)}
    >
      {/* Preview grid */}
      <div className="aspect-square bg-muted grid grid-cols-2 grid-rows-2 gap-px">
        {previewImages.length > 0 ? (
          previewImages.map((url, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={i}
              src={url}
              alt=""
              className="w-full h-full object-cover"
            />
          ))
        ) : (
          <div className="col-span-2 row-span-2 flex flex-col items-center justify-center gap-1.5">
            <Icon className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-[10px] text-muted-foreground/40">Empty</p>
          </div>
        )}
        {/* Fill empty grid cells */}
        {previewImages.length > 0 && previewImages.length < 4 &&
          Array.from({ length: 4 - previewImages.length }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-muted/50" />
          ))
        }
      </div>

      {/* Info */}
      <div className="p-2.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground truncate">
            {collection.name}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {items.length} item{items.length !== 1 ? 's' : ''} &middot; {collection.collection_type}
        </p>
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
        {onArchive && (
          <button
            onClick={e => { e.stopPropagation(); onArchive(collection.id) }}
            className="rounded-full bg-black/50 p-1 hover:bg-black/70 transition-colors"
            title="Archive"
          >
            <Archive className="h-3 w-3 text-white" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(collection.id) }}
            className="rounded-full bg-black/50 p-1 hover:bg-black/70 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3 text-white" />
          </button>
        )}
      </div>

      {/* Item count badge — hide when empty */}
      {items.length > 0 && (
        <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
          {items.length}
        </div>
      )}
    </div>
  )
}
