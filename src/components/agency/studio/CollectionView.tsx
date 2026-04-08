'use client'

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, GripVertical, ChevronUp, ChevronDown, X, Pencil, Check } from 'lucide-react'
import type { MediaCollectionItem, MediaCollection, MediaItem } from '@/types/database'

type ItemWithMedia = MediaCollectionItem & { media_items?: Pick<MediaItem, 'id' | 'file_url' | 'file_name' | 'file_type' | 'thumbnail_url' | 'tags' | 'ai_description'> | null }

interface CollectionViewProps {
  collectionId: string
  collection: MediaCollection
  onBack: () => void
  onUpdated?: () => void
}

const SLIDE_TYPES = ['intro', 'content', 'quote', 'stat', 'cta', 'outro'] as const

export function CollectionView({ collectionId, collection, onBack, onUpdated }: CollectionViewProps) {
  const [items, setItems] = useState<ItemWithMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSlide, setEditingSlide] = useState<string | null>(null)
  const [slideEdits, setSlideEdits] = useState<{ title: string; subtitle: string; caption: string; type: string }>({
    title: '', subtitle: '', caption: '', type: 'content',
  })

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`)
      if (res.ok) setItems(await res.json())
    } finally {
      setLoading(false)
    }
  }, [collectionId])

  useEffect(() => { fetchItems() }, [fetchItems])

  const moveItem = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= items.length) return

    const newItems = [...items]
    ;[newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]]

    // Optimistic update
    setItems(newItems)

    // Persist
    await fetch(`/api/collections/${collectionId}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: newItems.map((item, i) => ({ id: item.id, position: i })),
      }),
    })
    onUpdated?.()
  }

  const removeItem = async (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId))
    await fetch(`/api/collections/${collectionId}/items?itemId=${itemId}`, {
      method: 'DELETE',
    })
    onUpdated?.()
  }

  const startEditSlide = (item: ItemWithMedia) => {
    setEditingSlide(item.id)
    setSlideEdits({
      title: item.slide_title ?? '',
      subtitle: item.slide_subtitle ?? '',
      caption: item.slide_caption ?? '',
      type: item.slide_type ?? 'content',
    })
  }

  const saveSlideEdit = async () => {
    if (!editingSlide) return
    await fetch(`/api/collections/${collectionId}/items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingSlide,
        slide_title: slideEdits.title || null,
        slide_subtitle: slideEdits.subtitle || null,
        slide_caption: slideEdits.caption || null,
        slide_type: slideEdits.type,
      }),
    })
    setEditingSlide(null)
    fetchItems()
    onUpdated?.()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h3 className="text-sm font-semibold">{collection.name}</h3>
          <p className="text-[10px] text-muted-foreground">
            {collection.collection_type} &middot; {items.length} item{items.length !== 1 ? 's' : ''}
            {collection.description && ` &middot; ${collection.description}`}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items in this collection yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => {
            const media = item.media_items
            const isEditing = editingSlide === item.id

            return (
              <div
                key={item.id}
                className="flex gap-3 rounded-lg border border-border bg-muted p-2 hover:border-primary/30 transition-colors"
              >
                {/* Reorder controls */}
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <button
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0}
                    className="rounded p-0.5 hover:bg-muted disabled:opacity-20 transition-colors"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                  <button
                    onClick={() => moveItem(index, 'down')}
                    disabled={index === items.length - 1}
                    className="rounded p-0.5 hover:bg-muted disabled:opacity-20 transition-colors"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Slide number + thumbnail */}
                <div className="relative flex-shrink-0">
                  <div className="absolute -top-1 -left-1 z-10 rounded-full bg-[oklch(0.55_0.1_240)] w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white">
                    {index + 1}
                  </div>
                  {media?.file_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={media.thumbnail_url ?? media.file_url}
                      alt={media.file_name ?? ''}
                      className="h-20 w-20 rounded object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded bg-[oklch(0.1_0.005_240)] flex items-center justify-center text-[10px] text-muted-foreground">
                      No image
                    </div>
                  )}
                </div>

                {/* Slide info / editor */}
                <div className="flex-1 min-w-0 space-y-1">
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={slideEdits.title}
                        onChange={e => setSlideEdits(s => ({ ...s, title: e.target.value }))}
                        placeholder="Slide title..."
                        className="h-6 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={slideEdits.subtitle}
                        onChange={e => setSlideEdits(s => ({ ...s, subtitle: e.target.value }))}
                        placeholder="Subtitle..."
                        className="h-6 w-full rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <textarea
                        value={slideEdits.caption}
                        onChange={e => setSlideEdits(s => ({ ...s, caption: e.target.value }))}
                        placeholder="Caption text..."
                        rows={2}
                        className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <select
                          value={slideEdits.type}
                          onChange={e => setSlideEdits(s => ({ ...s, type: e.target.value }))}
                          className="h-6 rounded border border-input bg-background px-1.5 text-[10px] focus:outline-none"
                        >
                          {SLIDE_TYPES.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <button
                          onClick={saveSlideEdit}
                          className="inline-flex items-center gap-1 rounded bg-[oklch(0.55_0.1_240)] px-2 py-0.5 text-[10px] font-medium text-white hover:bg-[oklch(0.50_0.1_240)]"
                        >
                          <Check className="h-2.5 w-2.5" /> Save
                        </button>
                        <button
                          onClick={() => setEditingSlide(null)}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-full bg-[oklch(0.2_0.02_240)] px-1.5 py-px text-[9px] font-medium text-muted-foreground">
                          {item.slide_type}
                        </span>
                        {item.slide_title && (
                          <span className="text-xs font-medium truncate">{item.slide_title}</span>
                        )}
                      </div>
                      {item.slide_subtitle && (
                        <p className="text-[10px] text-muted-foreground truncate">{item.slide_subtitle}</p>
                      )}
                      {item.slide_caption && (
                        <p className="text-[10px] text-muted-foreground/70 line-clamp-2">{item.slide_caption}</p>
                      )}
                      {!item.slide_title && !item.slide_caption && (
                        <p className="text-[10px] text-muted-foreground/50 italic">
                          {media?.file_name ?? 'No overlay text set'}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1">
                  {!isEditing && (
                    <button
                      onClick={() => startEditSlide(item)}
                      className="rounded p-1 hover:bg-muted transition-colors"
                      title="Edit slide overlay"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="rounded p-1 hover:bg-muted transition-colors"
                    title="Remove from collection"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
