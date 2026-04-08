'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, ChevronUp, ChevronDown, ImagePlus, Loader2 } from 'lucide-react'

interface MediaItem {
  id: string
  file_url: string
  file_name: string
  file_type: string
  file_size: number
}

interface MediaSelectorProps {
  brandId: string
  selectedIds: string[]
  onChange: (ids: string[]) => void
  maxCount?: number
  acceptTypes?: string[] // e.g. ['image']
}

export function MediaSelector({
  brandId,
  selectedIds,
  onChange,
  maxCount = 10,
  acceptTypes,
}: MediaSelectorProps) {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!brandId) return
    setLoading(true)
    fetch(`/api/media?brandId=${brandId}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => {
        let items: MediaItem[] = data.items ?? data ?? []
        if (acceptTypes?.length) {
          items = items.filter((m) =>
            acceptTypes.some((t) => m.file_type.startsWith(t)),
          )
        }
        setMediaItems(items)
      })
      .catch(() => setMediaItems([]))
      .finally(() => setLoading(false))
  }, [brandId, acceptTypes])

  const toggleSelect = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((s) => s !== id))
      } else if (selectedIds.length < maxCount) {
        onChange([...selectedIds, id])
      }
    },
    [selectedIds, onChange, maxCount],
  )

  const moveUp = useCallback(
    (index: number) => {
      if (index === 0) return
      const next = [...selectedIds]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      onChange(next)
    },
    [selectedIds, onChange],
  )

  const moveDown = useCallback(
    (index: number) => {
      if (index >= selectedIds.length - 1) return
      const next = [...selectedIds]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      onChange(next)
    },
    [selectedIds, onChange],
  )

  const selectedItems = selectedIds
    .map((id) => mediaItems.find((m) => m.id === id))
    .filter(Boolean) as MediaItem[]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Selected items (ordered) */}
      {selectedItems.length > 0 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Selected ({selectedItems.length}/{maxCount})
          </label>
          <div className="flex gap-2 flex-wrap">
            {selectedItems.map((item, i) => (
              <div
                key={item.id}
                className="relative group rounded-lg overflow-hidden border border-border bg-muted"
                style={{ width: 72, height: 72 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.file_url}
                  alt={item.file_name}
                  className="w-full h-full object-cover"
                />
                {/* Order badge */}
                <span className="absolute top-1 left-1 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {i + 1}
                </span>
                {/* Controls overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => moveUp(i)}
                      className="p-0.5 rounded bg-white/20 hover:bg-white/40"
                    >
                      <ChevronUp className="h-3 w-3 text-white" />
                    </button>
                  )}
                  {i < selectedItems.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveDown(i)}
                      className="p-0.5 rounded bg-white/20 hover:bg-white/40"
                    >
                      <ChevronDown className="h-3 w-3 text-white" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleSelect(item.id)}
                    className="p-0.5 rounded bg-red-500/60 hover:bg-red-500/80"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media library grid */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          {selectedItems.length > 0 ? 'Add more' : 'Select from library'}
        </label>
        {mediaItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed border-border">
            <ImagePlus className="h-6 w-6 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">
              No images in your media library yet
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              Upload images in the Media tab first
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto rounded-lg">
            {mediaItems.map((item) => {
              const isSelected = selectedIds.includes(item.id)
              const isDisabled = !isSelected && selectedIds.length >= maxCount
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSelect(item.id)}
                  disabled={isDisabled}
                  className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                    isSelected
                      ? 'border-primary'
                      : isDisabled
                        ? 'border-transparent opacity-40 cursor-not-allowed'
                        : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.file_url}
                    alt={item.file_name}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
