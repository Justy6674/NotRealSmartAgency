'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { X, Loader2 } from 'lucide-react'
import { SOCIAL_CROP_PRESETS } from './CropPresets'

// Lazy load the heavy image editor (client-only, no SSR)
const FilerobotImageEditor = dynamic(
  () => import('react-filerobot-image-editor').then(mod => mod.default),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
)

interface ImageEditorModalProps {
  imageUrl: string
  brandId: string
  platform?: string
  onSave: (newMediaId: string, newUrl: string) => void
  onClose: () => void
}

export function ImageEditorModal({ imageUrl, brandId, platform, onSave, onClose }: ImageEditorModalProps) {
  const [saving, setSaving] = useState(false)

  // Build crop presets for Filerobot format
  const cropPresets = SOCIAL_CROP_PRESETS.map(p => ({
    titleKey: p.label,
    descriptionKey: `${p.ratio.toFixed(2)}`,
    ratio: p.ratio,
  }))

  const handleSave = useCallback(async (editedImageObject: { imageBase64?: string; fullName?: string }) => {
    if (!editedImageObject.imageBase64) return
    setSaving(true)

    try {
      // Convert base64 to blob
      const base64 = editedImageObject.imageBase64
      const byteString = atob(base64.split(',')[1] || base64)
      const mimeMatch = base64.match(/data:([^;]+);/)
      const mimeType = mimeMatch?.[1] || 'image/png'
      const ab = new ArrayBuffer(byteString.length)
      const ia = new Uint8Array(ab)
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i)
      }
      const blob = new Blob([ab], { type: mimeType })

      // Upload via media upload API
      const formData = new FormData()
      formData.append('file', blob, editedImageObject.fullName || 'edited-image.png')
      formData.append('brandId', brandId)
      formData.append('tags', 'edited')
      formData.append('description', `Edited version${platform ? ` for ${platform}` : ''}`)

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        onSave(data.id ?? data.media_item_id, data.file_url ?? data.url)
      }
    } catch (err) {
      console.error('Image editor save error:', err)
    } finally {
      setSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, platform, onSave])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'oklch(0 0 0 / 0.85)' }}>
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 rounded-full p-2 hover:bg-white/10 transition-colors"
      >
        <X className="h-5 w-5 text-white" />
      </button>

      {/* Saving overlay */}
      {saving && (
        <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'oklch(0 0 0 / 0.6)' }}>
          <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Saving edited image...</span>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="w-full h-full max-w-[95vw] max-h-[90vh]">
        <FilerobotImageEditor
          source={imageUrl}
          onSave={handleSave}
          onClose={onClose}
          annotationsCommon={{ fill: '#6366f1' }}
          Text={{ text: 'Add text...' }}
          Rotate={{ angle: 90, componentType: 'slider' }}
          Crop={{
            presetsItems: cropPresets,
            autoResize: true,
          }}
          tabsIds={['Finetune', 'Filters', 'Annotate', 'Resize'] as const}
          defaultTabId={'Finetune' as const}
          defaultToolId={'Crop' as const}
          savingPixelRatio={2}
          previewPixelRatio={2}
        />
      </div>
    </div>
  )
}
