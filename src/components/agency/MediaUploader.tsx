'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, Check, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'

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

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'video/webm']
const MAX_SIZE = 100 * 1024 * 1024 // 100MB

export function MediaUploader({ brandId, onUploadComplete }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = async (file: File): Promise<void> => {
    const entry: UploadProgress = { fileName: file.name, status: 'uploading' }
    setProgress(prev => [...prev, entry])

    try {
      // Validate
      if (!ALLOWED_TYPES.some(t => file.type.startsWith(t.split('/')[0]))) {
        throw new Error('Unsupported file type. Upload MP4, MOV, MP3, M4A, or WebM.')
      }
      if (file.size > MAX_SIZE) {
        throw new Error('File too large. Maximum 100MB.')
      }

      // Upload directly to Supabase Storage from the browser (bypasses Vercel 4.5MB limit)
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${brandId}/${timestamp}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      // Get public URL
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(storagePath)

      // Create database record
      const { data: mediaItem, error: dbError } = await supabase
        .from('media_items')
        .insert({
          user_id: user.id,
          brand_id: brandId,
          file_url: urlData.publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size_bytes: file.size,
          transcription_status: 'pending',
        })
        .select()
        .single()

      if (dbError) throw new Error(dbError.message)

      setProgress(prev =>
        prev.map(p => p.fileName === file.name ? { ...p, status: 'transcribing', mediaItemId: mediaItem.id } : p)
      )

      // Auto-transcribe via API (small JSON payload, no file)
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
