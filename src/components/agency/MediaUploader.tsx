'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, Check, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { generateDeterministicTags } from '@/lib/media/auto-tagger'

interface UploadProgress {
  fileName: string
  status: 'uploading' | 'analysing' | 'done' | 'error'
  percent: number
  mediaItemId?: string
  error?: string
}

interface MediaUploaderProps {
  brandId: string
  onUploadComplete: () => void
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'video/webm', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
const MAX_SIZE = 500 * 1024 * 1024 // 500MB (videos can be large)

/** Format bytes to human-readable size */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

export function MediaUploader({ brandId, onUploadComplete }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
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
    const sizeLabel = formatSize(file.size)
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

      // Upload with XHR for real-time progress tracking
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

      // Create database record with instant deterministic tags
      const isImage = file.type.startsWith('image/')
      const { data: mediaItem, error: dbError } = await supabase
        .from('media_items')
        .insert({
          user_id: user.id,
          brand_id: brandId,
          file_url: urlData.publicUrl,
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

      if (dbError) throw new Error(dbError.message)

      // Upload complete — show AI analysing status
      updateProgress(file.name, { status: 'analysing', percent: 100, mediaItemId: mediaItem.id })

      // Background processing: AI description, transcription, smart tags
      fetch('/api/media/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId: mediaItem.id }),
      })
        .then(() => {
          updateProgress(file.name, { status: 'done' })
          onUploadComplete() // Refresh media library to show updated tags
        })
        .catch(() => {
          updateProgress(file.name, { status: 'done' }) // Still mark done — upload succeeded
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
          {progress.map((p, i) => (
            <div key={i} className="relative overflow-hidden rounded bg-muted/50">
              {/* Progress bar background */}
              {p.status === 'uploading' && p.percent > 0 && p.percent < 100 && (
                <div
                  className="absolute inset-y-0 left-0 bg-blue-500/10 transition-all duration-300 ease-out"
                  style={{ width: `${p.percent}%` }}
                />
              )}
              {p.status === 'analysing' && (
                <div className="absolute inset-y-0 left-0 w-full bg-purple-500/5 animate-pulse" />
              )}
              <div className="relative flex items-center gap-2 text-sm p-2">
                {p.status === 'uploading' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />}
                {p.status === 'analysing' && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-purple-500" />}
                {p.status === 'done' && <Check className="h-4 w-4 shrink-0 text-green-500" />}
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
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {p.status === 'uploading' && p.percent > 0 && p.percent < 100 && `Uploading ${p.percent}%`}
                  {p.status === 'uploading' && p.percent === 0 && 'Uploading...'}
                  {p.status === 'uploading' && p.percent === 100 && 'Saving...'}
                  {p.status === 'analysing' && 'AI analysing...'}
                  {p.status === 'done' && 'Ready'}
                  {p.status === 'error' && p.error}
                </span>
                {/* Dismiss button for done items too */}
                {(p.status === 'done') && (
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
          ))}
        </div>
      )}
    </div>
  )
}
