'use client'

import { useState, useCallback } from 'react'
import { Upload, FileVideo, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import type { Brand } from '@/types/database'
import { sendToDirector } from '@/lib/chat-dispatch'

interface VideoImportPanelProps {
  brand: Brand | null
}

interface ImportedFile {
  id: string
  file: File
  status: 'uploading' | 'uploaded' | 'transcribing' | 'transcribed' | 'generating' | 'done' | 'error'
  mediaItemId?: string
  error?: string
}

export function VideoImportPanel({ brand }: VideoImportPanelProps) {
  const [files, setFiles] = useState<ImportedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const updateFile = (id: string, updates: Partial<ImportedFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const uploadAndTranscribe = useCallback(async (importedFile: ImportedFile) => {
    if (!brand) return

    // 1. Upload to Supabase Storage
    updateFile(importedFile.id, { status: 'uploading' })
    try {
      const formData = new FormData()
      formData.append('file', importedFile.file)
      formData.append('brandId', brand.id)

      const uploadRes = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) throw new Error('Upload failed')
      const uploadData = await uploadRes.json()
      const mediaItemId = uploadData.mediaItem?.id ?? uploadData.id

      updateFile(importedFile.id, { status: 'uploaded', mediaItemId })

      // 2. Transcribe
      updateFile(importedFile.id, { status: 'transcribing' })
      const transcribeRes = await fetch('/api/media/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId }),
      })

      if (!transcribeRes.ok) throw new Error('Transcription failed')
      updateFile(importedFile.id, { status: 'transcribed' })
    } catch (err) {
      updateFile(importedFile.id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Processing failed',
      })
    }
  }, [brand])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('video/') || f.type.startsWith('audio/')
    )

    const newFiles: ImportedFile[] = droppedFiles.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      status: 'uploading' as const,
    }))

    setFiles(prev => [...prev, ...newFiles])

    // Process all files in parallel
    await Promise.allSettled(newFiles.map(f => uploadAndTranscribe(f)))
  }, [uploadAndTranscribe])

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    const newFiles: ImportedFile[] = selectedFiles.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      status: 'uploading' as const,
    }))

    setFiles(prev => [...prev, ...newFiles])
    await Promise.allSettled(newFiles.map(f => uploadAndTranscribe(f)))
  }, [uploadAndTranscribe])

  const handleGenerateAll = () => {
    if (!brand) return
    const transcribedIds = files
      .filter(f => f.status === 'transcribed' && f.mediaItemId)
      .map(f => f.mediaItemId)

    if (transcribedIds.length === 0) return

    sendToDirector(
      `Process these ${transcribedIds.length} uploaded videos for ${brand.name}: generate platform-specific captions for all 6 platforms (YouTube, TikTok, Instagram, Facebook, LinkedIn, X) and save as draft posts.\n\nMedia item IDs: ${transcribedIds.join(', ')}`
    )
  }

  const transcribedCount = files.filter(f => f.status === 'transcribed' || f.status === 'done').length
  const processingCount = files.filter(f => ['uploading', 'uploaded', 'transcribing'].includes(f.status)).length

  const statusIcon = (status: ImportedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'transcribing':
      case 'generating':
        return <Loader2 className="h-4 w-4 animate-spin text-[oklch(0.55_0.1_240)]" />
      case 'transcribed':
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-400" />
      default:
        return <FileVideo className="h-4 w-4 text-muted-foreground" />
    }
  }

  const statusLabel = (status: ImportedFile['status']) => {
    const labels: Record<ImportedFile['status'], string> = {
      uploading: 'Uploading...',
      uploaded: 'Uploaded',
      transcribing: 'Transcribing...',
      transcribed: 'Ready',
      generating: 'Generating captions...',
      done: 'Done',
      error: 'Error',
    }
    return labels[status]
  }

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
          isDragOver
            ? 'border-[oklch(0.55_0.1_240)]/50 bg-[oklch(0.55_0.1_240)]/5'
            : 'border-border text-muted-foreground hover:border-[oklch(0.55_0.1_240)]/30'
        }`}
      >
        <Upload className="h-10 w-10" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop videos here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV, WebM — auto-transcribed on upload
          </p>
        </div>
        <label className="cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-xs text-foreground hover:bg-[oklch(0.55_0.1_240)]/5 transition-colors">
          Browse files
          <input
            type="file"
            accept="video/*,audio/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </h3>
            {processingCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {processingCount} processing...
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {files.map(f => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
              >
                {statusIcon(f.status)}
                <span className="flex-1 truncate text-sm text-foreground">{f.file.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  {(f.file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
                <span className={`text-[10px] ${f.status === 'error' ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {f.error ?? statusLabel(f.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate all captions button */}
      {transcribedCount > 0 && (
        <button
          type="button"
          onClick={handleGenerateAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-4 py-3 text-sm font-medium text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate Captions for All Platforms ({transcribedCount} video{transcribedCount !== 1 ? 's' : ''})
        </button>
      )}
    </div>
  )
}
