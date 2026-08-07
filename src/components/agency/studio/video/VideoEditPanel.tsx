'use client'

import { useState, useRef } from 'react'
import {
  Upload,
  Eye,
  Captions,
  SplitSquareVertical,
  Sparkles,
  Play,
  Pause,
  Loader2,
} from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import { createClient } from '@/lib/supabase/client'
import type { Brand } from '@/types/database'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface VideoEditPanelProps {
  brand: Brand | null
  strategyContext: StrategyContext | null
}

type ProcessingStage =
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'transcribing'
  | 'analysing'
  | 'ready'

 
interface VisualAnalysis {
  summary?: string
  products?: string[]
  mood?: string
  scenes?: string[]
  text_on_screen?: string[]
  [key: string]: any
}

const STAGE_LABELS: Record<ProcessingStage, string> = {
  idle: '',
  uploading: 'Uploading...',
  extracting: 'Extracting frames...',
  transcribing: 'Transcribing...',
  analysing: 'Analysing...',
  ready: 'Ready',
}

function buildAIAssists(
  brand: Brand | null,
  mediaItemId: string | null,
  analysis: VisualAnalysis | null
) {
  return [
    {
      id: 'describe',
      icon: Eye,
      label: 'AI Describe',
      disabled: !mediaItemId,
      isAnalyse: true,
      getPrompt: () => null,
    },
    {
      id: 'captions',
      icon: Captions,
      label: 'Generate Captions',
      disabled: !mediaItemId,
      isAnalyse: false,
      getPrompt: () => {
        if (!brand || !mediaItemId) return null
        const parts = [
          `Generate platform-specific captions for media item ${mediaItemId} for ${brand.name}.`,
          'Create captions for TikTok, Instagram, Facebook, LinkedIn, YouTube, and X.',
          analysis?.summary ? `Video content: ${analysis.summary}` : '',
          brand.tone_of_voice
            ? `Brand voice: ${brand.tone_of_voice.formality ?? ''}, ${brand.tone_of_voice.humour ?? 'no'} humour.`
            : '',
        ]
        return parts.filter(Boolean).join('\n')
      },
    },
    {
      id: 'clips',
      icon: SplitSquareVertical,
      label: 'Suggest Clips',
      disabled: !mediaItemId,
      isAnalyse: false,
      getPrompt: () => {
        if (!brand || !mediaItemId) return null
        return [
          `Analyse media item ${mediaItemId} for ${brand.name} and suggest where to split into shorter clips for social media.`,
          analysis?.summary ? `Video content: ${analysis.summary}` : '',
          analysis?.scenes?.length ? `Scenes: ${analysis.scenes.join('; ')}` : '',
          'Suggest 2-4 clip segments with timestamps and platform recommendations.',
        ]
          .filter(Boolean)
          .join('\n')
      },
    },
    {
      id: 'improve',
      icon: Sparkles,
      label: 'Improve Content',
      disabled: !mediaItemId,
      isAnalyse: false,
      getPrompt: () => {
        if (!brand || !mediaItemId) return null
        return [
          `Review and improve the captions and description for media item ${mediaItemId} for ${brand.name}.`,
          analysis?.summary ? `Video shows: ${analysis.summary}` : '',
          'Make captions more engaging, add relevant hashtags, and optimise for each platform.',
        ]
          .filter(Boolean)
          .join('\n')
      },
    },
  ] as const
}

export function VideoEditPanel({ brand, strategyContext }: VideoEditPanelProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [mediaItemId, setMediaItemId] = useState<string | null>(null)
  const [transcription, setTranscription] = useState<string | null>(null)
  const [visualAnalysis, setVisualAnalysis] = useState<VisualAnalysis | null>(null)
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle')
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setVideoSrc(URL.createObjectURL(file))
    // Reset state for new file
    setMediaItemId(null)
    setTranscription(null)
    setVisualAnalysis(null)
    setProcessingStage('idle')
    setError(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('video/')) return
    setVideoFile(file)
    setVideoSrc(URL.createObjectURL(file))
    setMediaItemId(null)
    setTranscription(null)
    setVisualAnalysis(null)
    setProcessingStage('idle')
    setError(null)
  }

  const handleUploadAndProcess = async () => {
    if (!videoFile || !brand) return
    setError(null)

    try {
      // 1. Upload directly to Supabase Storage (bypasses Vercel 4.5MB limit)
      setProcessingStage('uploading')
      const supabaseUpload = createClient()
      const { data: { user } } = await supabaseUpload.auth.getUser()
      if (!user) {
        setError('Not authenticated.')
        setProcessingStage('idle')
        return
      }

      const timestamp = Date.now()
      const safeName = videoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${brand.id}/${timestamp}_${safeName}`

      const { error: storageError } = await supabaseUpload.storage
        .from('media')
        .upload(storagePath, videoFile, {
          contentType: videoFile.type,
          upsert: false,
        })

      if (storageError) {
        setError(`Upload failed: ${storageError.message}`)
        setProcessingStage('idle')
        return
      }

      const { data: urlData } = supabaseUpload.storage.from('media').getPublicUrl(storagePath)

      const { data: mediaRecord, error: dbError } = await supabaseUpload
        .from('media_items')
        .insert({
          user_id: user.id,
          brand_id: brand.id,
          file_url: urlData.publicUrl,
          file_name: videoFile.name,
          file_type: videoFile.type,
          file_size_bytes: videoFile.size,
          transcription_status: 'pending',
        })
        .select()
        .single()

      if (dbError || !mediaRecord) {
        setError('Upload succeeded but failed to create record.')
        setProcessingStage('idle')
        return
      }
      const itemId: string = mediaRecord.id
      setMediaItemId(itemId)

      // 2. Extract frames
      setProcessingStage('extracting')
      try {
        const { extractFramesFromVideo } = await import(
          '@/lib/video/extract-frames-browser'
        )
        const frames = await extractFramesFromVideo(videoFile, 4)

        if (frames.length > 0) {
          const supabase = createClient()
          const frameUrls: string[] = []
          for (let i = 0; i < frames.length; i++) {
            const path = `frames/${itemId}/frame-${i}.jpg`
            const { error: uploadErr } = await supabase.storage
              .from('media')
              .upload(path, frames[i], {
                contentType: 'image/jpeg',
                upsert: true,
              })
            if (!uploadErr) {
              const {
                data: { publicUrl },
              } = supabase.storage.from('media').getPublicUrl(path)
              frameUrls.push(publicUrl)
            }
          }

          // Save frame URLs to the media item
          if (frameUrls.length > 0) {
            await fetch(`/api/media/${itemId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ frame_urls: frameUrls }),
            }).catch(() => {
              // Non-critical — frames are already in storage
            })
          }
        }
      } catch {
        // Frame extraction is non-critical, continue pipeline
      }

      // 3. Transcribe
      setProcessingStage('transcribing')
      try {
        const transcribeRes = await fetch('/api/media/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaItemId: itemId }),
        })
        if (transcribeRes.ok) {
          const data = await transcribeRes.json()
          setTranscription(data.transcription ?? null)
        }
      } catch {
        // Transcription failure is non-critical
      }

      // 4. Analyse
      setProcessingStage('analysing')
      try {
        const analyzeRes = await fetch(`/api/media/${itemId}/analyze`, {
          method: 'POST',
        })
        if (analyzeRes.ok) {
          const { analysis } = await analyzeRes.json()
          setVisualAnalysis(analysis ?? null)
        }
      } catch {
        // Analysis failure is non-critical
      }

      setProcessingStage('ready')
    } catch (err) {
      console.error('Upload pipeline failed:', err)
      setError('Something went wrong. Please try again.')
      setProcessingStage('idle')
    }
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleAIAssist = async (assist: ReturnType<typeof buildAIAssists>[number]) => {
    if (!brand) return

    if (assist.isAnalyse) {
      // AI Describe triggers the analyse endpoint directly
      if (!mediaItemId) return
      setProcessingStage('analysing')
      try {
        const res = await fetch(`/api/media/${mediaItemId}/analyze`, {
          method: 'POST',
        })
        if (res.ok) {
          const { analysis } = await res.json()
          setVisualAnalysis(analysis ?? null)
        }
      } catch {
        // Non-critical
      }
      setProcessingStage(transcription || visualAnalysis ? 'ready' : 'idle')
      return
    }

    const prompt = assist.getPrompt()
    if (!prompt) return

    const message = [
      prompt,
      strategyContext?.agentContext ?? '',
    ]
      .filter(Boolean)
      .join('\n')

    sendToDirector(message)
  }

  const assists = buildAIAssists(brand, mediaItemId, visualAnalysis)
  const isProcessing = processingStage !== 'idle' && processingStage !== 'ready'
  const hasIntelligence = transcription || visualAnalysis

  return (
    <div className="space-y-6">
      {/* Import zone */}
      {!videoSrc && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Import a video to edit
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
            >
              <Upload className="h-8 w-8" />
              <span className="text-sm">Drop a file or click to browse</span>
              <span className="text-[10px]">MP4, MOV, WebM up to 500MB</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* Video player and controls */}
      {videoSrc && (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              src={videoSrc}
              className="h-full w-full object-contain"
              onEnded={() => setIsPlaying(false)}
            />
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
            >
              {isPlaying ? (
                <Pause className="h-12 w-12 text-white" />
              ) : (
                <Play className="h-12 w-12 text-white" />
              )}
            </button>
          </div>

          {/* Processing progress */}
          {isProcessing && (
            <div className="flex items-center gap-2 rounded-lg border border-[oklch(0.55_0.1_240)]/20 bg-[oklch(0.55_0.1_240)]/5 px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-[oklch(0.55_0.1_240)]" />
              <span className="text-sm text-foreground">
                {STAGE_LABELS[processingStage]}
              </span>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          {/* Intelligence panel — transcription + visual analysis */}
          {hasIntelligence && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* Left: Transcription */}
              {transcription && (
                <div className="rounded-lg border border-border bg-card p-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Transcription
                  </h4>
                  <div className="max-h-48 overflow-y-auto text-sm text-foreground leading-relaxed">
                    {transcription}
                  </div>
                </div>
              )}

              {/* Right: Visual Analysis */}
              {visualAnalysis && (
                <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Visual Analysis
                  </h4>

                  {visualAnalysis.summary && (
                    <p className="text-sm font-medium text-foreground">
                      {visualAnalysis.summary}
                    </p>
                  )}

                  {visualAnalysis.products && visualAnalysis.products.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Products
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {visualAnalysis.products.map((p: string) => (
                          <span
                            key={p}
                            className="inline-block rounded-full bg-[oklch(0.55_0.1_240)]/10 px-2 py-0.5 text-[11px] text-foreground"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {visualAnalysis.mood && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Mood
                      </span>
                      <p className="text-sm text-foreground">{visualAnalysis.mood}</p>
                    </div>
                  )}

                  {visualAnalysis.scenes && visualAnalysis.scenes.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Scenes
                      </span>
                      <ol className="mt-1 list-decimal pl-4 text-sm text-foreground space-y-0.5">
                        {visualAnalysis.scenes.map((s: string, i: number) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {visualAnalysis.text_on_screen &&
                    visualAnalysis.text_on_screen.length > 0 && (
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Text on screen
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {visualAnalysis.text_on_screen.map((t: string) => (
                            <span
                              key={t}
                              className="inline-block rounded-full bg-[oklch(0.55_0.1_240)]/10 px-2 py-0.5 text-[11px] text-foreground"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          )}

          {/* AI Assist buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">AI Assist</label>
            <div className="grid grid-cols-2 gap-2">
              {assists.map((a) => {
                const Icon = a.icon
                return (
                  <button
                    key={a.id}
                    type="button"
                    disabled={a.disabled || isProcessing}
                    onClick={() => handleAIAssist(a)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {a.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Upload & Analyse button */}
          <button
            type="button"
            onClick={handleUploadAndProcess}
            disabled={isProcessing || !videoFile || !brand || processingStage === 'ready'}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:bg-[oklch(0.55_0.1_240)]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {STAGE_LABELS[processingStage]}
              </>
            ) : processingStage === 'ready' ? (
              <>
                <Upload className="h-4 w-4" />
                Uploaded & Analysed
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload & Analyse
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
