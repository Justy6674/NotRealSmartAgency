'use client'

import { useState, useCallback } from 'react'
import { Upload, FileVideo, CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import type { Brand, VisualAnalysis } from '@/types/database'
import { sendToDirector } from '@/lib/chat-dispatch'
import { extractFramesFromVideo } from '@/lib/video/extract-frames-browser'
import { createClient } from '@/lib/supabase/client'

interface VideoImportPanelProps {
  brand: Brand | null
}

interface ImportedFile {
  id: string
  file: File
  status: 'uploading' | 'uploaded' | 'transcribing' | 'transcribed' | 'analysing' | 'analysed' | 'generating' | 'done' | 'error'
  mediaItemId?: string
  error?: string
  analysis?: VisualAnalysis
  thumbnailUrl?: string
}

export function VideoImportPanel({ brand }: VideoImportPanelProps) {
  const [files, setFiles] = useState<ImportedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const updateFile = (id: string, updates: Partial<ImportedFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const uploadAndTranscribe = useCallback(async (importedFile: ImportedFile) => {
    if (!brand) return

    const supabase = createClient()

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

      // 2. Extract frames in browser (non-blocking — runs alongside transcription)
      const { data: { user } } = await supabase.auth.getUser()
      let framesUploaded = false

      if (user && importedFile.file.type.startsWith('video/')) {
        try {
          const frames = await extractFramesFromVideo(importedFile.file, 4)
          const frameUrls: string[] = []

          for (let i = 0; i < frames.length; i++) {
            const framePath = `${user.id}/${brand.id}/frames/${mediaItemId}_frame_${i}.jpg`
            const { data: frameData } = await supabase.storage
              .from('media')
              .upload(framePath, frames[i], { contentType: 'image/jpeg', upsert: true })
            if (frameData) {
              const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(framePath)
              frameUrls.push(publicUrl)
            }
          }

          if (frameUrls.length) {
            await supabase.from('media_items').update({
              metadata: { frame_urls: frameUrls },
            }).eq('id', mediaItemId)
            framesUploaded = true
          }
        } catch {
          // Frame extraction failure is non-blocking
        }
      }

      // 3. Transcribe
      updateFile(importedFile.id, { status: 'transcribing' })
      const transcribeRes = await fetch('/api/media/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId }),
      })

      if (!transcribeRes.ok) throw new Error('Transcription failed')
      updateFile(importedFile.id, { status: 'transcribed' })

      // 4. Visual analysis (only if frames were uploaded)
      if (framesUploaded) {
        updateFile(importedFile.id, { status: 'analysing' })
        try {
          const analyzeRes = await fetch(`/api/media/${mediaItemId}/analyze`, { method: 'POST' })
          if (analyzeRes.ok) {
            const { analysis, thumbnail_url } = await analyzeRes.json()
            updateFile(importedFile.id, {
              status: 'analysed',
              analysis,
              thumbnailUrl: thumbnail_url,
            })
          } else {
            // Analysis failure is non-blocking — still mark as ready
            updateFile(importedFile.id, { status: 'analysed' })
          }
        } catch {
          updateFile(importedFile.id, { status: 'analysed' })
        }
      }
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
    const readyIds = files
      .filter(f => (f.status === 'transcribed' || f.status === 'analysed') && f.mediaItemId)
      .map(f => f.mediaItemId)

    if (readyIds.length === 0) return

    sendToDirector(
      `Process these ${readyIds.length} uploaded videos for ${brand.name}: generate platform-specific captions for all 6 platforms (YouTube, TikTok, Instagram, Facebook, LinkedIn, X) and save as draft posts.\n\nMedia item IDs: ${readyIds.join(', ')}`
    )
  }

  const readyCount = files.filter(f => f.status === 'transcribed' || f.status === 'analysed' || f.status === 'done').length
  const processingCount = files.filter(f => ['uploading', 'uploaded', 'transcribing', 'analysing'].includes(f.status)).length

  const statusIcon = (status: ImportedFile['status']) => {
    switch (status) {
      case 'uploading':
      case 'transcribing':
      case 'analysing':
      case 'generating':
        return <Loader2 className="h-4 w-4 animate-spin text-[oklch(0.55_0.1_240)]" />
      case 'transcribed':
      case 'analysed':
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
      analysing: 'Analysing...',
      analysed: 'Ready',
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
                {f.thumbnailUrl ? (
                  <img src={f.thumbnailUrl} alt="" className="h-8 w-8 rounded object-cover" />
                ) : (
                  statusIcon(f.status)
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-foreground">{f.file.name}</span>
                  {f.analysis?.summary && (
                    <span className="truncate text-[10px] text-muted-foreground max-w-[200px]">
                      {f.analysis.summary}
                    </span>
                  )}
                </div>
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
      {readyCount > 0 && (
        <button
          type="button"
          onClick={handleGenerateAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-4 py-3 text-sm font-medium text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate Smart Captions for All Platforms ({readyCount} video{readyCount !== 1 ? 's' : ''})
        </button>
      )}
    </div>
  )
}
