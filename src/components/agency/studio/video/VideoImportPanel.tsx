'use client'

import { useState, useCallback } from 'react'
import { Upload, FileVideo, FileText, CheckCircle2, Loader2, Sparkles, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { Brand, ScheduledPost, VisualAnalysis, ContentVibe, HashtagStyle, CarouselMode, ContentType, ContentStyleSettings } from '@/types/database'
import { sendToDirector } from '@/lib/chat-dispatch'
import { extractFramesFromVideo } from '@/lib/video/extract-frames-browser'
import { createClient } from '@/lib/supabase/client'
import { PostReviewPanel } from '../PostReviewPanel'
import { useConnectedPlatforms } from '@/hooks/useConnectedPlatforms'

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
  const [showReview, setShowReview] = useState(false)
  const [draftPosts, setDraftPosts] = useState<ScheduledPost[]>([])
  const { platforms: connectedPlatforms } = useConnectedPlatforms(brand?.id ?? null)
  const [styleOpen, setStyleOpen] = useState(false)
  const [styleSettings, setStyleSettings] = useState<ContentStyleSettings>({
    vibe: 'informative',
    content_type: 'entertainment',
    carousel_mode: 'off',
    carousel_slide_count: 5,
    hashtag_style: 'trending_niche',
    post_count: 'auto',
  })
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(() => new Set())
  const [platformsInitialised, setPlatformsInitialised] = useState(false)

  // Default to connected platforms only (once loaded)
  if (!platformsInitialised && connectedPlatforms.length > 0) {
    setSelectedPlatforms(new Set(connectedPlatforms))
    setPlatformsInitialised(true)
  }

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(platform)) {
        if (next.size > 1) next.delete(platform) // must keep at least 1
      } else {
        next.add(platform)
      }
      return next
    })
  }

  const updateFile = (id: string, updates: Partial<ImportedFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f))
  }

  const uploadAndTranscribe = useCallback(async (importedFile: ImportedFile) => {
    if (!brand) return

    const supabase = createClient()

    // 1. Upload directly to Supabase Storage (bypasses Vercel 4.5MB limit)
    updateFile(importedFile.id, { status: 'uploading' })
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const timestamp = Date.now()
      const safeName = importedFile.file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${brand.id}/${timestamp}_${safeName}`

      const { error: storageError } = await supabase.storage
        .from('media')
        .upload(storagePath, importedFile.file, {
          contentType: importedFile.file.type,
          upsert: false,
        })

      if (storageError) throw new Error(`Upload failed: ${storageError.message}`)

      const { data: urlData } = supabase.storage.from('media').getPublicUrl(storagePath)

      const { data: mediaRecord, error: dbError } = await supabase
        .from('media_items')
        .insert({
          user_id: user.id,
          brand_id: brand.id,
          file_url: urlData.publicUrl,
          file_name: importedFile.file.name,
          file_type: importedFile.file.type,
          file_size_bytes: importedFile.file.size,
          transcription_status: 'pending',
        })
        .select()
        .single()

      if (dbError || !mediaRecord) throw new Error('Failed to create media record')
      const mediaItemId = mediaRecord.id

      updateFile(importedFile.id, { status: 'uploaded', mediaItemId })

      const isImage = importedFile.file.type.startsWith('image/')
      const isVideo = importedFile.file.type.startsWith('video/')
      let framesUploaded = false

      if (isImage) {
        // For images: use the uploaded image itself as the "frame" for analysis
        await supabase.from('media_items').update({
          metadata: { frame_urls: [urlData.publicUrl] },
          thumbnail_url: urlData.publicUrl,
        }).eq('id', mediaItemId)
        framesUploaded = true

        // Skip transcription — go straight to analysis
        updateFile(importedFile.id, { status: 'analysing' })
        try {
          const analyzeRes = await fetch(`/api/media/${mediaItemId}/analyze`, { method: 'POST' })
          if (analyzeRes.ok) {
            const { analysis, thumbnail_url } = await analyzeRes.json()
            updateFile(importedFile.id, {
              status: 'analysed',
              analysis,
              thumbnailUrl: thumbnail_url ?? urlData.publicUrl,
            })
          } else {
            updateFile(importedFile.id, { status: 'analysed', thumbnailUrl: urlData.publicUrl })
          }
        } catch {
          updateFile(importedFile.id, { status: 'analysed', thumbnailUrl: urlData.publicUrl })
        }
      } else {
        // For video/audio: extract frames + transcribe + analyse
        // 2. Extract frames in browser
        if (user && isVideo) {
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

        // 3. Transcribe (video/audio only)
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
              updateFile(importedFile.id, { status: 'analysed' })
            }
          } catch {
            updateFile(importedFile.id, { status: 'analysed' })
          }
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
      f.type.startsWith('video/') || f.type.startsWith('audio/') || f.type.startsWith('image/')
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

    const vibeText = styleSettings.vibe !== 'informative' ? `\nVibe: ${styleSettings.vibe} — write in a ${styleSettings.vibe} tone.` : ''
    const hashtagText = `\nHashtag style: ${styleSettings.hashtag_style.replace(/_/g, ' ')}.`
    const contentTypeText = `\nContent type: ${styleSettings.content_type}.`

    let carouselText = ''
    if (styleSettings.carousel_mode !== 'off' && readyCount > 1) {
      const slideCount = styleSettings.carousel_mode === 'custom'
        ? styleSettings.carousel_slide_count ?? 5
        : Math.min(readyCount, 10)
      carouselText = `\nCarousel mode: group into sets of ${slideCount} for carousel posts. Write one unified caption per platform per carousel set, referencing the slide progression.`
    }

    const platformNames: Record<string, string> = {
      instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn',
      tiktok: 'TikTok', youtube: 'YouTube', twitter: 'X',
    }
    const platformList = Array.from(selectedPlatforms).map(p => platformNames[p] ?? p).join(', ')

    sendToDirector(
      `Process these ${readyIds.length} uploaded files for ${brand.name}: generate platform-specific captions for these platforms: ${platformList}. Save as draft posts.${vibeText}${contentTypeText}${hashtagText}${carouselText}\n\nMedia item IDs: ${readyIds.join(', ')}`
    )
  }

  const handleViewDrafts = async () => {
    if (!brand) return
    const res = await fetch(`/api/scheduled-posts?brandId=${brand.id}&status=draft`)
    if (res.ok) {
      const posts = await res.json()
      setDraftPosts(posts)
      setShowReview(true)
    }
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
          <p className="text-sm font-medium text-foreground">Drop files here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Videos, photos, or audio — AI describes and captions everything
          </p>
        </div>
        <label className="cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-xs text-foreground hover:bg-[oklch(0.55_0.1_240)]/5 transition-colors">
          Browse files
          <input
            type="file"
            accept="video/*,audio/*,image/*"
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

      {/* Content Style Panel */}
      {readyCount > 0 && (
        <div className="rounded-xl border border-border bg-card/50">
          <button
            type="button"
            onClick={() => setStyleOpen(!styleOpen)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
          >
            Content Style
            {styleOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {styleOpen && (
            <div className="space-y-4 px-4 pb-4">
              {/* Vibe */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Vibe</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['funny', 'inspirational', 'informative', 'exciting', 'educational', 'provocative'] as ContentVibe[]).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setStyleSettings(s => ({ ...s, vibe: v }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        styleSettings.vibe === v
                          ? 'bg-[oklch(0.55_0.1_240)] text-white'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Type */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Content Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {(['entertainment', 'education', 'inspiration', 'promotional'] as ContentType[]).map(ct => (
                    <button
                      key={ct}
                      type="button"
                      onClick={() => setStyleSettings(s => ({ ...s, content_type: ct }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        styleSettings.content_type === ct
                          ? 'bg-[oklch(0.55_0.1_240)] text-white'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {ct.charAt(0).toUpperCase() + ct.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Carousel Mode */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Carousel</label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {(['off', 'auto_group', 'custom'] as CarouselMode[]).map(cm => (
                    <button
                      key={cm}
                      type="button"
                      onClick={() => setStyleSettings(s => ({ ...s, carousel_mode: cm }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        styleSettings.carousel_mode === cm
                          ? 'bg-[oklch(0.55_0.1_240)] text-white'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cm === 'off' ? 'Off' : cm === 'auto_group' ? 'Auto-group' : 'Custom'}
                    </button>
                  ))}
                  {styleSettings.carousel_mode === 'custom' && (
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={styleSettings.carousel_slide_count ?? 5}
                      onChange={e => setStyleSettings(s => ({ ...s, carousel_slide_count: parseInt(e.target.value) || 5 }))}
                      className="w-14 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground text-center"
                    />
                  )}
                </div>
              </div>

              {/* Hashtag Style */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Hashtags</label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'trending_niche' as HashtagStyle, label: 'Trending + Niche' },
                    { id: 'niche_only' as HashtagStyle, label: 'Niche Only' },
                    { id: 'branded_only' as HashtagStyle, label: 'Branded Only' },
                    { id: 'mix_all' as HashtagStyle, label: 'Mix of All' },
                  ]).map(hs => (
                    <button
                      key={hs.id}
                      type="button"
                      onClick={() => setStyleSettings(s => ({ ...s, hashtag_style: hs.id }))}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        styleSettings.hashtag_style === hs.id
                          ? 'bg-[oklch(0.55_0.1_240)] text-white'
                          : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {hs.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platforms */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Platforms {connectedPlatforms.length > 0 && <span className="normal-case font-normal">— connected shown first</span>}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { id: 'instagram', label: 'Instagram' },
                    { id: 'facebook', label: 'Facebook' },
                    { id: 'linkedin', label: 'LinkedIn' },
                    { id: 'tiktok', label: 'TikTok' },
                    { id: 'youtube', label: 'YouTube' },
                    { id: 'twitter', label: 'X' },
                  ])
                    .sort((a, b) => {
                      const aConn = connectedPlatforms.includes(a.id) ? 0 : 1
                      const bConn = connectedPlatforms.includes(b.id) ? 0 : 1
                      return aConn - bConn
                    })
                    .map(p => {
                      const isConn = connectedPlatforms.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlatform(p.id)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            selectedPlatforms.has(p.id)
                              ? isConn
                                ? 'bg-[oklch(0.55_0.1_240)] text-white'
                                : 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                              : 'bg-muted text-muted-foreground hover:text-foreground line-through opacity-50'
                          }`}
                          title={isConn ? `${p.label} — connected via Mixpost` : `${p.label} — not connected (download only)`}
                        >
                          {p.label}
                          {!isConn && selectedPlatforms.has(p.id) && <span className="ml-1 text-[8px]">(manual)</span>}
                        </button>
                      )
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Generate captions button */}
      {readyCount > 0 && (
        <button
          type="button"
          onClick={handleGenerateAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[oklch(0.75_0.06_240)] px-4 py-3 text-sm font-medium text-[oklch(0.15_0.02_240)] hover:bg-[oklch(0.80_0.06_240)] transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate Smart Captions ({readyCount} file{readyCount !== 1 ? 's' : ''} → {selectedPlatforms.size} platform{selectedPlatforms.size !== 1 ? 's' : ''})
        </button>
      )}

      {/* View drafts button */}
      <button
        type="button"
        onClick={handleViewDrafts}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
      >
        <FileText className="h-4 w-4" />
        View &amp; Schedule Drafts
      </button>

      {/* Inline post review panel */}
      {showReview && brand && (
        <PostReviewPanel
          posts={draftPosts}
          brand={brand}
          connectedPlatforms={connectedPlatforms}
          onClose={() => setShowReview(false)}
          onUpdate={handleViewDrafts}
        />
      )}
    </div>
  )
}
