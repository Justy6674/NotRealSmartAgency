'use client'

import { useState, useCallback, useEffect } from 'react'
import { Upload, Loader2, CheckCircle2, Maximize2 } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'

interface UploadedAsset {
  id: string
  file: File
  previewUrl: string
  status: 'uploading' | 'uploaded' | 'error'
  mediaItemId?: string
  error?: string
}

interface DesignUploadPanelProps {
  brand: Brand | null
}

export function DesignUploadPanel({ brand }: DesignUploadPanelProps) {
  const [assets, setAssets] = useState<UploadedAsset[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const updateAsset = (id: string, updates: Partial<UploadedAsset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const uploadFile = useCallback(async (asset: UploadedAsset) => {
    if (!brand) return

    try {
      const formData = new FormData()
      formData.append('file', asset.file)
      formData.append('brandId', brand.id)

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      updateAsset(asset.id, {
        status: 'uploaded',
        mediaItemId: data.mediaItem?.id ?? data.id,
      })
    } catch (err) {
      updateAsset(asset.id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      })
    }
  }, [brand])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    )

    const newAssets: UploadedAsset[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: 'uploading' as const,
    }))

    setAssets(prev => [...prev, ...newAssets])
    await Promise.allSettled(newAssets.map(a => uploadFile(a)))
  }, [uploadFile])

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f =>
      f.type.startsWith('image/')
    )

    const newAssets: UploadedAsset[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: 'uploading' as const,
    }))

    setAssets(prev => [...prev, ...newAssets])
    await Promise.allSettled(newAssets.map(a => uploadFile(a)))
  }, [uploadFile])

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleResizeAll = () => {
    if (!brand) return
    const selected = assets.filter(a => selectedIds.has(a.id) && a.status === 'uploaded')
    if (selected.length === 0) return

    sendToDirector(
      `Resize these ${selected.length} uploaded image(s) for all social media platforms (IG Post 1080x1080, IG Story 1080x1920, FB 1200x630, LinkedIn 1200x627, TikTok 1080x1920, YT Thumbnail 1280x720) for ${brand.name}. Apply the brand overlay (logo, colours) if available.\n\nMedia item IDs: ${selected.map(a => a.mediaItemId).filter(Boolean).join(', ')}`
    )
  }

  const handleDeleteAsset = (id: string) => {
    setAssets(prev => {
      const asset = prev.find(a => a.id === id)
      if (asset) URL.revokeObjectURL(asset.previewUrl)
      return prev.filter(a => a.id !== id)
    })
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      assets.forEach(a => URL.revokeObjectURL(a.previewUrl))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const uploadedCount = assets.filter(a => a.status === 'uploaded').length

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
          isDragOver
            ? 'border-primary/50 bg-primary/5'
            : 'border-border text-muted-foreground hover:border-primary/30'
        }`}
      >
        <Upload className="h-10 w-10" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop images here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPG, SVG, WebP
          </p>
        </div>
        <label className="cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-xs text-foreground hover:bg-primary/5 transition-colors">
          Browse files
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
      </div>

      {/* Asset grid */}
      {assets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Uploaded ({uploadedCount})
            </h3>
            {selectedIds.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selected
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {assets.map(asset => (
              <div key={asset.id} className="relative group">
                <button
                  onClick={() => asset.status === 'uploaded' && toggleSelect(asset.id)}
                  disabled={asset.status !== 'uploaded'}
                  className={`w-full rounded-xl border overflow-hidden aspect-square transition-all ${
                    selectedIds.has(asset.id)
                      ? 'border-primary/50 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  <img
                    src={asset.previewUrl}
                    alt={asset.file.name}
                    className="h-full w-full object-cover"
                  />
                  {asset.status === 'uploading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </div>
                  )}
                  {asset.status === 'uploaded' && selectedIds.has(asset.id) && (
                    <div className="absolute top-1.5 right-1.5">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                  )}
                  {asset.status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                      <span className="text-[10px] text-red-400">{asset.error}</span>
                    </div>
                  )}
                </button>
                {/* Delete button */}
                <button
                  onClick={() => handleDeleteAsset(asset.id)}
                  className="absolute top-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resize for all platforms button */}
      {selectedIds.size > 0 && (
        <button
          onClick={handleResizeAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Maximize2 className="h-4 w-4" />
          Resize for All Platforms ({selectedIds.size} image{selectedIds.size !== 1 ? 's' : ''})
        </button>
      )}
    </div>
  )
}
