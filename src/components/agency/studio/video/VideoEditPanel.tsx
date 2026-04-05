'use client'

import { useState, useRef } from 'react'
import {
  Upload,
  Scissors,
  Captions,
  SplitSquareVertical,
  Sparkles,
  Play,
  Pause,
  Loader2,
} from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface VideoEditPanelProps {
  brand: Brand | null
  strategyContext: StrategyContext | null
}

const AI_ASSISTS = [
  {
    id: 'silence',
    icon: Scissors,
    label: 'Auto-cut silence',
    prompt: 'Analyse this video and remove all silent sections longer than 1.5 seconds.',
  },
  {
    id: 'captions',
    icon: Captions,
    label: 'Add captions',
    prompt: 'Transcribe this video and add burnt-in captions with platform-appropriate styling.',
  },
  {
    id: 'splits',
    icon: SplitSquareVertical,
    label: 'Suggest splits',
    prompt: 'Analyse this video and suggest where to split it into shorter clips for social media.',
  },
  {
    id: 'enhance',
    icon: Sparkles,
    label: 'AI enhance',
    prompt: 'Suggest improvements for this video: colour grading, pacing, transitions, and text overlays.',
  },
]

export function VideoEditPanel({ brand, strategyContext }: VideoEditPanelProps) {
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [uploading, setUploading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    setVideoSrc(URL.createObjectURL(file))
  }

  const handleUploadToLibrary = async () => {
    if (!videoFile || !brand) return
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', videoFile)
      formData.append('brandId', brand.id)

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
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

  const handleAIAssist = (prompt: string) => {
    if (!brand) return
    const message = [
      prompt,
      `Brand: ${brand.name}.`,
      videoFile ? `Video file: ${videoFile.name}` : '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)
  }

  return (
    <div className="space-y-6">
      {/* Import zone */}
      {!videoSrc && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Import a video to edit</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-muted-foreground hover:border-[oklch(0.55_0.1_240)]/30 hover:text-foreground transition-colors"
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

          {/* Timeline editor placeholder */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground text-center">
              Timeline editor — Twick/Remotion integration renders here.
            </p>
          </div>

          {/* AI assist buttons */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">AI Assist</label>
            <div className="grid grid-cols-2 gap-2">
              {AI_ASSISTS.map(a => {
                const Icon = a.icon
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleAIAssist(a.prompt)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-[oklch(0.55_0.1_240)]/30 hover:text-foreground transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {a.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Upload to library button */}
          <button
            type="button"
            onClick={handleUploadToLibrary}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:bg-[oklch(0.55_0.1_240)]/5 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Save to Media Library
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
