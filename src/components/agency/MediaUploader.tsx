'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, Check, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { generateDeterministicTags } from '@/lib/media/auto-tagger'

interface UploadProgress {
  fileName: string
  status: 'uploading' | 'processing' | 'done' | 'error'
  mediaItemId?: string
  error?: string
}

interface MediaUploaderProps {
  brandId: string
  onUploadComplete: () => void
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'video/webm', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
const MAX_SIZE = 500 * 1024 * 1024 // 500MB (videos can be large)

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
        throw new Error('File too large. Maximum 500MB.')
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

      // Upload complete — mark as done immediately
      setProgress(prev =>
        prev.map(p => p.fileName === file.name ? { ...p, status: 'done', mediaItemId: mediaItem.id } : p)
      )

      // Fire-and-forget: background processing (AI description, transcription, smart tags)
      // This runs async — the UI doesn't wait for it
      fetch('/api/media/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId: mediaItem.id }),
      }).catch(() => {}) // Silent failure — processing is non-blocking

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
            <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
              {p.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              {p.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-amber-500" />}
              {p.status === 'done' && <Check className="h-4 w-4 text-green-500" />}
              {p.status === 'error' && <X className="h-4 w-4 text-red-500" />}
              <span className="flex-1 truncate">{p.fileName}</span>
              <span className="text-xs text-muted-foreground">
                {p.status === 'uploading' && 'Uploading...'}
                {p.status === 'processing' && 'Processing...'}
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
