'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Loader2, Check, X } from 'lucide-react'

interface UploadProgress {
  fileName: string
  status: 'uploading' | 'transcribing' | 'done' | 'error'
  mediaItemId?: string
  error?: string
}

interface MediaUploaderProps {
  brandId: string
  onUploadComplete: () => void
}

export function MediaUploader({ brandId, onUploadComplete }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = async (file: File): Promise<void> => {
    const entry: UploadProgress = { fileName: file.name, status: 'uploading' }
    setProgress(prev => [...prev, entry])

    try {
      // Upload
      const formData = new FormData()
      formData.append('file', file)
      formData.append('brandId', brandId)

      const uploadRes = await fetch('/api/media/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error ?? 'Upload failed')
      }

      const mediaItem = await uploadRes.json()

      setProgress(prev =>
        prev.map(p => p.fileName === file.name ? { ...p, status: 'transcribing', mediaItemId: mediaItem.id } : p)
      )

      // Auto-transcribe
      const transcribeRes = await fetch('/api/media/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId: mediaItem.id }),
      })

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json()
        throw new Error(err.error ?? 'Transcription failed')
      }

      setProgress(prev =>
        prev.map(p => p.fileName === file.name ? { ...p, status: 'done' } : p)
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed'
      setProgress(prev =>
        prev.map(p => p.fileName === file.name ? { ...p, status: 'error', error: message } : p)
      )
    }
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true)
    const fileArray = Array.from(files)

    // Process sequentially to avoid overwhelming the server
    for (const file of fileArray) {
      await processFile(file)
    }

    setUploading(false)
    onUploadComplete()
  }, [brandId, onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium">Drop videos here or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">MP4, MOV, MP3, M4A, WebM — max 100MB per file</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {progress.length > 0 && (
        <div className="space-y-2">
          {progress.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
              {p.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              {p.status === 'transcribing' && <Loader2 className="h-4 w-4 animate-spin text-amber-500" />}
              {p.status === 'done' && <Check className="h-4 w-4 text-green-500" />}
              {p.status === 'error' && <X className="h-4 w-4 text-red-500" />}
              <span className="flex-1 truncate">{p.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {p.status === 'uploading' && 'Uploading...'}
                {p.status === 'transcribing' && 'Transcribing...'}
                {p.status === 'done' && 'Ready'}
                {p.status === 'error' && p.error}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
