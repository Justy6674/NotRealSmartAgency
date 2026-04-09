'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, Check, X, AlertTriangle } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { generateDeterministicTags } from '@/lib/media/auto-tagger'

type StageStatus = 'ok' | 'failed' | 'skipped'
interface StageReport {
  status: StageStatus
  error?: string
  duration_ms?: number
}
interface ProcessingReport {
  thumbnail: StageReport
  transcription: StageReport
  ai: StageReport
  completed_at: string
}

interface UploadProgress {
  fileName: string
  /**
   * Upload state machine:
   *   uploading → file bytes are streaming to Supabase Storage
   *   processing → upload done, background pipeline running (thumbnail/transcript/AI)
   *   ready      → processing finished, all stages attempted, row persisted
   *   warning    → processing finished but one or more stages failed (file is still usable)
   *   error      → fatal: upload itself failed, row may not exist
   */
  status: 'uploading' | 'processing' | 'ready' | 'warning' | 'error'
  percent: number
  mediaItemId?: string
  error?: string
  report?: ProcessingReport
}

interface MediaUploaderProps {
  brandId: string
  onUploadComplete: () => void
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'video/webm', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
const MAX_SIZE = 500 * 1024 * 1024 // 500MB (videos can be large)

/**
 * Upload a file to Supabase Storage using XHR for progress tracking.
 * Must include both Authorization (user token) and apikey (anon key) headers.
 */
function uploadWithProgress(
  supabaseUrl: string,
  anonKey: string,
  bucket: string,
  path: string,
  file: File,
  token: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const encodedPath = path.split('/').map(encodeURIComponent).join('/')
    const url = `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100)
        onProgress(percent)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        let msg = `Upload failed (${xhr.status})`
        try {
          const body = JSON.parse(xhr.responseText)
          msg = body.error ?? body.message ?? msg
        } catch { /* use default msg */ }
        reject(new Error(msg))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Upload failed — network error')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.send(file)
  })
}

/** Build a short human summary of a processing report. */
function summariseReport(report: ProcessingReport, isVideo: boolean, isImage: boolean): { message: string; hasFailure: boolean } {
  const parts: string[] = []
  let hasFailure = false

  if (isVideo) {
    if (report.thumbnail.status === 'ok') parts.push('thumbnail')
    else if (report.thumbnail.status === 'failed') { parts.push('no thumbnail'); hasFailure = true }
  }

  if (isImage) {
    if (report.ai.status === 'ok') parts.push('tagged')
    else if (report.ai.status === 'failed') { parts.push('tagging failed'); hasFailure = true }
  } else {
    if (report.transcription.status === 'ok') parts.push('transcribed')
    else if (report.transcription.status === 'failed') { parts.push('transcription failed'); hasFailure = true }
    else if (report.transcription.status === 'skipped' && report.transcription.error?.includes('too large')) parts.push('too large to transcribe')

    if (report.ai.status === 'ok') parts.push('tagged')
    else if (report.ai.status === 'failed') { parts.push('tagging failed'); hasFailure = true }
  }

  const message = parts.length ? parts.join(' · ') : 'Ready'
  return { message, hasFailure }
}

/** Build a detailed tooltip listing every stage's outcome with errors. */
function detailedReport(report: ProcessingReport): string {
  const lines: string[] = []
  const stages: Array<[string, StageReport]> = [
    ['Thumbnail', report.thumbnail],
    ['Transcription', report.transcription],
    ['AI tagging', report.ai],
  ]
  for (const [label, stage] of stages) {
    if (stage.status === 'ok') {
      lines.push(`${label}: ok${stage.duration_ms ? ` (${(stage.duration_ms / 1000).toFixed(1)}s)` : ''}`)
    } else if (stage.status === 'failed') {
      lines.push(`${label}: FAILED — ${stage.error ?? 'unknown error'}`)
    } else {
      lines.push(`${label}: skipped${stage.error ? ` (${stage.error})` : ''}`)
    }
  }
  return lines.join('\n')
}

export function MediaUploader({ brandId, onUploadComplete }: MediaUploaderProps) {
  const [, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const dismissItem = (fileName: string) => {
    setProgress(prev => prev.filter(p => p.fileName !== fileName))
  }

  const updateProgress = (fileName: string, updates: Partial<UploadProgress>) => {
    setProgress(prev =>
      prev.map(p => p.fileName === fileName ? { ...p, ...updates } : p)
    )
  }

  const processFile = async (file: File): Promise<void> => {
    setProgress(prev => [...prev, { fileName: file.name, status: 'uploading', percent: 0 }])

    try {
      // Validate
      if (!ALLOWED_TYPES.some(t => file.type.startsWith(t.split('/')[0]))) {
        throw new Error('Unsupported file type. Upload MP4, MOV, MP3, M4A, or WebM.')
      }
      if (file.size > MAX_SIZE) {
        throw new Error('File too large. Maximum 500MB.')
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

      const supabase = createBrowserClient(supabaseUrl, anonKey)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const user = session.user
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${brandId}/${timestamp}_${safeName}`

      // Upload main file FIRST. The file going to Supabase Storage is the ONLY
      // thing that must succeed for the upload to be considered a success. All
      // downstream processing (thumbnails, transcription, AI tagging) happens
      // server-side in /api/media/process and is non-fatal.
      await uploadWithProgress(
        supabaseUrl,
        anonKey,
        'media',
        storagePath,
        file,
        session.access_token,
        (percent) => updateProgress(file.name, { percent })
      )

      // Get public URL
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(storagePath)

      // Fetch brand context for deterministic tags
      const { data: brand } = await supabase
        .from('brands')
        .select('name, niche, content_pillars, compliance_flags')
        .eq('id', brandId)
        .single()

      const deterministicTags = generateDeterministicTags(brand, file.type, file.name)

      // Create database record with instant deterministic tags.
      // thumbnail_url starts null — the server-side processor fills it in
      // via ffmpeg in /api/media/process (streaming frame 1 from the URL).
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')
      const { data: mediaItem, error: dbError } = await supabase
        .from('media_items')
        .insert({
          user_id: user.id,
          brand_id: brandId,
          file_url: urlData.publicUrl,
          thumbnail_url: null,
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
          transcription_status: isImage ? 'transcribed' : 'pending',
          file_created_at: new Date(file.lastModified).toISOString(),
          uploaded_by_name: user.user_metadata?.full_name ?? user.email ?? 'Unknown',
          tags: deterministicTags,
        })
        .select()
        .single()

      if (dbError) throw new Error(`Could not save to library: ${dbError.message}`)

      // Upload complete — move to processing state. The file is safe at this
      // point; nothing from here can lose it.
      updateProgress(file.name, { status: 'processing', percent: 100, mediaItemId: mediaItem.id })

      // Server-side pipeline: thumbnail (ffmpeg URL stream) + transcription + AI tags.
      // Fire-and-forget so multiple files can process in parallel — but we DO
      // read the response when it arrives, so the row can update with real outcomes.
      fetch('/api/media/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId: mediaItem.id }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            updateProgress(file.name, {
              status: 'warning',
              error: body.error ?? `Processing failed (${res.status})`,
              report: body.report,
            })
            onUploadComplete()
            return
          }
          const body = await res.json()
          const report: ProcessingReport | undefined = body.report
          if (report) {
            const { hasFailure } = summariseReport(report, isVideo, isImage)
            updateProgress(file.name, {
              status: hasFailure ? 'warning' : 'ready',
              report,
            })
          } else {
            updateProgress(file.name, { status: 'ready' })
          }
          onUploadComplete() // refresh library so new thumbnail + tags show
        })
        .catch((err) => {
          // Network failure reaching /api/media/process. The file IS saved;
          // it just has no thumbnail/transcript/tags yet. User can retry
          // processing manually later from the library.
          updateProgress(file.name, {
            status: 'warning',
            error: `Processing unreachable — file saved, no AI analysis (${err instanceof Error ? err.message : 'network error'})`,
          })
          onUploadComplete()
        })

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed'
      updateProgress(file.name, { status: 'error', error: message })
    }
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true)
    const fileArray = Array.from(files)

    for (const file of fileArray) {
      await processFile(file)
    }

    setUploading(false)
    onUploadComplete()
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <p className="text-sm font-medium">Drop files here or click to upload</p>
        <p className="text-xs text-muted-foreground mt-1">Videos, photos, or audio — AI describes and captions everything</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {progress.length > 0 && (
        <div className="space-y-2">
          {progress.map((p, i) => {
            // Derive status pill text and colour per state.
            const isVideo = p.fileName.match(/\.(mp4|mov|webm|m4v)$/i) !== null
            const isImage = p.fileName.match(/\.(jpg|jpeg|png|webp|gif|heic)$/i) !== null
            let statusText = ''
            if (p.status === 'uploading') {
              if (p.percent === 0) statusText = 'Uploading...'
              else if (p.percent === 100) statusText = 'Saving...'
              else statusText = `Uploading ${p.percent}%`
            } else if (p.status === 'processing') {
              statusText = isImage ? 'AI tagging...' : isVideo ? 'Processing: thumbnail, transcript, tags...' : 'Processing...'
            } else if (p.status === 'ready' && p.report) {
              statusText = summariseReport(p.report, isVideo, isImage).message
            } else if (p.status === 'ready') {
              statusText = 'Ready'
            } else if (p.status === 'warning' && p.report) {
              statusText = summariseReport(p.report, isVideo, isImage).message
            } else if (p.status === 'warning') {
              statusText = p.error ?? 'Saved with warnings'
            } else if (p.status === 'error') {
              statusText = p.error ?? 'Failed'
            }

            const tooltip = p.report ? detailedReport(p.report) : (p.error ?? '')

            return (
              <div key={i} className="relative overflow-hidden rounded bg-muted/50">
                {p.status === 'uploading' && p.percent > 0 && p.percent < 100 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-blue-500/10 transition-all duration-300 ease-out"
                    style={{ width: `${p.percent}%` }}
                  />
                )}
                {p.status === 'processing' && (
                  <div className="absolute inset-y-0 left-0 w-full bg-purple-500/5 animate-pulse" />
                )}
                <div className="relative flex items-center gap-2 text-sm p-2">
                  {p.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />}
                  {p.status === 'processing' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-purple-500" />}
                  {p.status === 'ready' && <Check className="h-4 w-4 shrink-0 text-green-500" />}
                  {p.status === 'warning' && <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />}
                  {p.status === 'error' && (
                    <button
                      onClick={() => dismissItem(p.fileName)}
                      className="shrink-0 rounded-full p-0.5 hover:bg-red-500/20 transition-colors"
                      title="Dismiss"
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </button>
                  )}
                  <span className="flex-1 truncate">{p.fileName}</span>
                  <span
                    className="text-xs text-muted-foreground shrink-0 tabular-nums max-w-[50%] truncate"
                    title={tooltip || undefined}
                  >
                    {statusText}
                  </span>
                  {(p.status === 'ready' || p.status === 'warning') && (
                    <button
                      onClick={() => dismissItem(p.fileName)}
                      className="shrink-0 rounded-full p-0.5 hover:bg-muted transition-colors opacity-50 hover:opacity-100"
                      title="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
