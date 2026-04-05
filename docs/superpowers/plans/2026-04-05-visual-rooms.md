# Visual Rooms Implementation Plan (Video Room + Design Room)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans

**Goal:** Build the Video Room (/agency/studio/video) and Design Room (/agency/studio/design)

**Architecture:** Video Room has 3 paths (AI generates, manual edit via Twick, bulk import via C.A.M.). Design Room has 3 paths (AI designs via Canva API, browse/edit in Canva, upload own). Both use RoomLayout, sendToDirector for AI, strategy context.

**Tech Stack:** Next.js 15, React 19, Twick (video editor), Canva Connect API, HeyGen API, OpenClaw Video Toolkit, ffmpeg.wasm, TypeScript

**Dependencies:** Foundation plan must be complete (it is). Twick and ffmpeg.wasm need npm install.

---

## Existing Infrastructure (already built, do NOT recreate)

| Asset | Location | Purpose |
|-------|----------|---------|
| `RoomLayout` | `src/components/agency/studio/RoomLayout.tsx` | Shared room shell with back nav, StrategyBrief, chat auto-open |
| `StrategyBrief` | `src/components/agency/studio/StrategyBrief.tsx` | Strategy one-liner at top of every room |
| `useStrategyContext` | `src/hooks/useStrategyContext.ts` | Calculates what content is needed from brand + posts + accounts |
| `useStudioData` | `src/hooks/useStudioData.ts` | Fetches brand, posts, Mixpost accounts for a brand |
| `sendToDirector` | `src/lib/chat-dispatch.ts` | DOM event dispatch to chat panel — `sendToDirector(message)` |
| `CreateHub` | `src/components/agency/studio/CreateHub.tsx` | Launchpad cards linking to room routes |
| Video route stub | `src/app/agency/studio/video/page.tsx` | `'use client'` + `force-dynamic` + `RoomLayout` shell |
| Design route stub | `src/app/agency/studio/design/page.tsx` | Same as above |
| `/api/video/generate` | `src/app/api/video/generate/route.ts` | HeyGen video generation from output script |
| `/api/video/status` | `src/app/api/video/status/route.ts` | Poll HeyGen job status |
| `/api/canva/designs` | `src/app/api/canva/designs/route.ts` | Fetch user's Canva designs with auto token refresh |
| `/api/canva/auth` | `src/app/api/canva/auth/route.ts` | Canva OAuth initiation |
| `/api/canva/callback` | `src/app/api/canva/callback/route.ts` | Canva OAuth callback |
| `/api/media/upload` | `src/app/api/media/upload/route.ts` | Direct upload to Supabase Storage `media` bucket |
| `/api/media/transcribe` | `src/app/api/media/transcribe/route.ts` | Deepgram + Whisper fallback transcription |
| `create_video` tool | `src/lib/agents/tools/create-video.ts` | HeyGen video generation via agent tool |
| Canva tools | `src/lib/agents/tools/canva.ts` | `design_graphic`, `export_design`, `search_designs`, `list_brand_kits`, `get_design`, `list_folder_items`, `search_folders` |
| `process_media` tool | `src/lib/agents/tools/process-media.ts` | Full pipeline: transcribe -> generate captions -> create draft posts |
| OpenClaw toolkit | `~/.claude/video-toolkit-tools/` | AI video production (Remotion + cloud GPU) |
| Zustand store | `src/stores/agency-store.ts` | `activeBrandId`, `activeAgentType`, etc. |

### Key Patterns to Follow

**Sending to Director with strategy context:**
```typescript
import { sendToDirector } from '@/lib/chat-dispatch'

function handleAIGenerate(topic: string, platform: string) {
  const ctx = strategyContext?.agentContext ?? ''
  sendToDirector(
    `Create a ${platform} video about "${topic}" for ${brand?.name}.\n\n${ctx}`
  )
}
```

**Canva API key retrieval (already in canva.ts tools):**
```typescript
// User-specific key first (user_integrations), then env var fallback
const apiKey = userIntegrationKey ?? process.env.CANVA_API_KEY
```

**Format dimensions (from canva.ts):**
```typescript
const FORMAT_DIMENSIONS = {
  instagram_post: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  facebook_post: { width: 1200, height: 630 },
  linkedin_post: { width: 1200, height: 627 },
  twitter_post: { width: 1600, height: 900 },
  tiktok_video: { width: 1080, height: 1920 },
  youtube_thumbnail: { width: 1280, height: 720 },
  presentation: { width: 1920, height: 1080 },
  a4_document: { width: 595, height: 842 },
}
```

---

## VIDEO ROOM

### Task 1: Install Video Editor Dependencies

**Files:** `package.json`

- [ ] **Step 1: Check if Twick is available as an npm package**

```bash
npm search twick --no-description 2>/dev/null | head -5
npm info @twick/react version 2>/dev/null || echo "not found"
npm info @twick/core version 2>/dev/null || echo "not found"
```

- [ ] **Step 2: Install based on availability**

If Twick packages exist:
```bash
cd /Users/jb-downscale/NotRealSmartAgency
npm install @twick/react @twick/core
```

If Twick is NOT available as npm packages, install Remotion instead:
```bash
cd /Users/jb-downscale/NotRealSmartAgency
npm install remotion @remotion/player @remotion/cli
```

Also install ffmpeg.wasm for client-side processing:
```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

- [ ] **Step 3: Verify installation**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm ls @twick/react @ffmpeg/ffmpeg 2>/dev/null || npm ls remotion @ffmpeg/ffmpeg
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install video editor and ffmpeg.wasm dependencies"
```

---

### Task 2: VideoModeSelector Component

**Files:**
- Create: `src/components/agency/studio/video/VideoModeSelector.tsx`

- [ ] **Step 1: Create the mode selector with 3 tabs**

```typescript
'use client'

import { useState } from 'react'
import { Sparkles, Film, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export type VideoMode = 'create' | 'edit' | 'import'

interface VideoModeSelectorProps {
  mode: VideoMode
  onModeChange: (mode: VideoMode) => void
}

const MODES = [
  {
    id: 'create' as const,
    icon: Sparkles,
    label: 'Create',
    description: 'AI generates your video',
  },
  {
    id: 'edit' as const,
    icon: Film,
    label: 'Edit',
    description: 'Import and edit manually',
  },
  {
    id: 'import' as const,
    icon: Upload,
    label: 'Import',
    description: 'Bulk upload and process',
  },
]

export function VideoModeSelector({ mode, onModeChange }: VideoModeSelectorProps) {
  return (
    <div className="flex gap-2">
      {MODES.map(m => {
        const Icon = m.icon
        const active = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all',
              active
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium">{m.label}</div>
              <div className="text-[10px] opacity-70">{m.description}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/video/VideoModeSelector.tsx
git commit -m "feat: VideoModeSelector component with 3 tabs"
```

---

### Task 3: VideoCreatePanel — AI Generation Path

**Files:**
- Create: `src/components/agency/studio/video/VideoCreatePanel.tsx`

This panel lets the user describe a video topic, pick a provider (HeyGen avatar or OpenClaw template), select platform format, and hit "Generate". It sends the full request to the Director via `sendToDirector` with strategy context embedded.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { Sparkles, Wand2, Loader2 } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface VideoCreatePanelProps {
  brand: Brand | null
  strategyContext: StrategyContext | null
}

type Provider = 'heygen' | 'openclaw'
type AspectRatio = '9:16' | '16:9' | '1:1'

const PROVIDERS: { id: Provider; label: string; description: string }[] = [
  { id: 'heygen', label: 'HeyGen Avatar', description: 'AI presenter speaks your script' },
  { id: 'openclaw', label: 'OpenClaw / Remotion', description: 'Template-based with AI voiceover' },
]

const FORMATS: { id: AspectRatio; label: string; platforms: string }[] = [
  { id: '9:16', label: 'Vertical (9:16)', platforms: 'TikTok, Reels, Shorts' },
  { id: '16:9', label: 'Landscape (16:9)', platforms: 'YouTube, LinkedIn, Facebook' },
  { id: '1:1', label: 'Square (1:1)', platforms: 'Instagram Feed, Facebook' },
]

export function VideoCreatePanel({ brand, strategyContext }: VideoCreatePanelProps) {
  const [topic, setTopic] = useState('')
  const [provider, setProvider] = useState<Provider>('heygen')
  const [format, setFormat] = useState<AspectRatio>('9:16')
  const [sending, setSending] = useState(false)

  const handleGenerate = () => {
    if (!brand) return
    setSending(true)

    const topicLine = topic.trim()
      ? `Topic: "${topic.trim()}"`
      : 'Choose the best topic based on the strategy context below.'

    const message = [
      `Create a ${format} video for ${brand.name} using ${provider === 'heygen' ? 'HeyGen (AI avatar presenter)' : 'OpenClaw/Remotion (template-based)'}.`,
      topicLine,
      `Platform format: ${FORMATS.find(f => f.id === format)?.platforms ?? format}.`,
      '',
      'Write the script, check compliance, then generate the video.',
      '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)

    // Reset after a beat so the user sees the chat open
    setTimeout(() => setSending(false), 1500)
  }

  const handleLetAIChoose = () => {
    if (!brand) return
    setSending(true)

    const message = [
      `Suggest the best video topic for ${brand.name} right now based on the strategy.`,
      'Consider what content type is needed, which platform is underserved, and what pillar to rotate to.',
      'Write the script and generate the video using HeyGen.',
      '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)
    setTimeout(() => setSending(false), 1500)
  }

  return (
    <div className="space-y-6">
      {/* Topic input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">What is the video about?</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. 5 tips for managing weight during winter"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
          <button
            onClick={handleLetAIChoose}
            disabled={sending || !brand}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Let AI choose
          </button>
        </div>
      </div>

      {/* Provider selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Video style</label>
        <div className="grid grid-cols-2 gap-3">
          {PROVIDERS.map(p => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`rounded-lg border p-3 text-left transition-all ${
                provider === p.id
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <div className="text-sm font-medium text-foreground">{p.label}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{p.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Platform format selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Format</label>
        <div className="flex gap-2">
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`flex-1 rounded-lg border p-2.5 text-center transition-all ${
                format === f.id
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border bg-card hover:border-primary/30'
              }`}
            >
              <div className="text-xs font-medium text-foreground">{f.label}</div>
              <div className="mt-0.5 text-[9px] text-muted-foreground">{f.platforms}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={sending || !brand}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending to Director...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Video
          </>
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/video/VideoCreatePanel.tsx
git commit -m "feat: VideoCreatePanel with AI topic input, provider selector, and format picker"
```

---

### Task 4: VideoEditPanel — Manual Editing Path

**Files:**
- Create: `src/components/agency/studio/video/VideoEditPanel.tsx`

This panel provides a video editing workspace. It wraps Twick (or Remotion Player if Twick unavailable) for timeline editing, and provides AI-assist buttons that call `sendToDirector`.

**Important:** The exact Twick/Remotion API may vary. Write the wrapper structure and UI, with clear comments where the editor integration plugs in. The import source selector, AI assist buttons, and video preview use standard React — only the timeline editor itself depends on the third-party library.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useRef } from 'react'
import {
  Upload,
  Library,
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

type ImportSource = 'file' | 'library' | 'canva' | 'heygen'

const IMPORT_SOURCES: { id: ImportSource; label: string; icon: typeof Upload }[] = [
  { id: 'file', label: 'Upload file', icon: Upload },
  { id: 'library', label: 'Media library', icon: Library },
]

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      // Upload succeeded — media item is now in Supabase Storage
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
      `${prompt}`,
      `Brand: ${brand.name}.`,
      videoFile ? `Video file: ${videoFile.name}` : '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)
  }

  return (
    <div className="space-y-6">
      {/* Import source */}
      {!videoSrc && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">Import a video to edit</label>
          <div className="flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
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

      {/* Video preview + controls */}
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

          {/* Timeline editor placeholder — Twick or Remotion goes here */}
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground text-center">
              Timeline editor — Twick/Remotion integration renders here.
              {/* 
                Integration notes:
                - If using Twick: <TwickEditor src={videoSrc} onExport={handleExport} />
                - If using Remotion: <Player component={VideoComposition} ... />
                - Both support: trim markers, text overlay tracks, multi-track timeline
                - Export: Twick uses serverless MP4 export; Remotion uses @remotion/renderer
              */}
            </p>
          </div>

          {/* Basic controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Trim start (seconds)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                defaultValue={0}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Trim end (seconds)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* Text overlay input */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Text overlay</label>
            <input
              type="text"
              placeholder="Add text to your video..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
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
                    onClick={() => handleAIAssist(a.prompt)}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors"
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
            onClick={handleUploadToLibrary}
            disabled={uploading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:bg-primary/5 transition-colors disabled:opacity-50"
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/video/VideoEditPanel.tsx
git commit -m "feat: VideoEditPanel with file import, preview, trim controls, and AI assist buttons"
```

---

### Task 5: VideoImportPanel — Bulk C.A.M. Path

**Files:**
- Create: `src/components/agency/studio/video/VideoImportPanel.tsx`

Reuses the existing media upload and transcription pipeline. Drag and drop multiple videos, auto-transcribe, generate captions for all platforms in batch.

- [ ] **Step 1: Create the component**

```typescript
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

  const uploadAndTranscribe = async (importedFile: ImportedFile) => {
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
  }

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
  }, [brand])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    const newFiles: ImportedFile[] = selectedFiles.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      status: 'uploading' as const,
    }))

    setFiles(prev => [...prev, ...newFiles])
    await Promise.allSettled(newFiles.map(f => uploadAndTranscribe(f)))
  }

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
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
            ? 'border-primary/50 bg-primary/5'
            : 'border-border text-muted-foreground hover:border-primary/30'
        }`}
      >
        <Upload className="h-10 w-10" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop videos here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV, WebM — auto-transcribed on upload
          </p>
        </div>
        <label className="cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-xs text-foreground hover:bg-primary/5 transition-colors">
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
          onClick={handleGenerateAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate Captions for All Platforms ({transcribedCount} video{transcribedCount !== 1 ? 's' : ''})
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/video/VideoImportPanel.tsx
git commit -m "feat: VideoImportPanel with drag-and-drop bulk upload and auto-transcription"
```

---

### Task 6: VideoExporter Component

**Files:**
- Create: `src/components/agency/studio/video/VideoExporter.tsx`

Export and scheduling controls. Appears below the video preview in both Create and Edit modes after content is generated.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { Download, CalendarPlus, Send, Loader2 } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'

interface VideoExporterProps {
  brand: Brand | null
  videoTitle?: string
  outputId?: string
}

const PLATFORM_FORMATS = [
  { id: 'tiktok', label: 'TikTok / Reels', dimensions: '1080x1920', ratio: '9:16' },
  { id: 'youtube', label: 'YouTube', dimensions: '1920x1080', ratio: '16:9' },
  { id: 'instagram_feed', label: 'Instagram Feed', dimensions: '1080x1080', ratio: '1:1' },
  { id: 'linkedin', label: 'LinkedIn', dimensions: '1920x1080', ratio: '16:9' },
  { id: 'facebook', label: 'Facebook', dimensions: '1280x720', ratio: '16:9' },
]

export function VideoExporter({ brand, videoTitle, outputId }: VideoExporterProps) {
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['tiktok'])
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [action, setAction] = useState<'save' | 'schedule' | 'publish'>('save')

  const toggleFormat = (id: string) => {
    setSelectedFormats(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    )
  }

  const handleExport = () => {
    if (!brand) return

    const platformNames = selectedFormats
      .map(id => PLATFORM_FORMATS.find(p => p.id === id)?.label)
      .filter(Boolean)
      .join(', ')

    let actionText = ''
    if (action === 'save') {
      actionText = 'Save to the output library.'
    } else if (action === 'schedule') {
      actionText = `Schedule for ${scheduleDate} at ${scheduleTime} AEST.`
    } else {
      actionText = 'Publish now via Mixpost.'
    }

    sendToDirector(
      `Export the video "${videoTitle ?? 'latest video'}" for ${brand.name} to these formats: ${platformNames}. ${actionText}${outputId ? `\n\nOutput ID: ${outputId}` : ''}`
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Export & Schedule</h3>

      {/* Platform format checkboxes */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Platform formats</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_FORMATS.map(p => (
            <button
              key={p.id}
              onClick={() => toggleFormat(p.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                selectedFormats.includes(p.id)
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              {p.label}
              <span className="ml-1 text-[9px] opacity-60">{p.dimensions}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action selector */}
      <div className="flex gap-2">
        {(['save', 'schedule', 'publish'] as const).map(a => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-all ${
              action === a
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:border-primary/30'
            }`}
          >
            {a === 'save' && 'Save to Library'}
            {a === 'schedule' && 'Schedule'}
            {a === 'publish' && 'Publish Now'}
          </button>
        ))}
      </div>

      {/* Schedule date/time picker */}
      {action === 'schedule' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Date</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={e => setScheduleDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Time (AEST)</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={e => setScheduleTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={selectedFormats.length === 0 || !brand}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {action === 'save' && <Download className="h-4 w-4" />}
        {action === 'schedule' && <CalendarPlus className="h-4 w-4" />}
        {action === 'publish' && <Send className="h-4 w-4" />}
        {action === 'save' && 'Save to Library'}
        {action === 'schedule' && 'Add to Calendar'}
        {action === 'publish' && 'Publish Now'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/video/VideoExporter.tsx
git commit -m "feat: VideoExporter with platform format selector, schedule picker, and publish options"
```

---

### Task 7: VideoRoom Component — Assembles Everything

**Files:**
- Create: `src/components/agency/studio/video/VideoRoom.tsx`

- [ ] **Step 1: Create the composite component**

```typescript
'use client'

import { useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { VideoModeSelector, type VideoMode } from './VideoModeSelector'
import { VideoCreatePanel } from './VideoCreatePanel'
import { VideoEditPanel } from './VideoEditPanel'
import { VideoImportPanel } from './VideoImportPanel'
import { VideoExporter } from './VideoExporter'

export function VideoRoom() {
  const [mode, setMode] = useState<VideoMode>('create')
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  if (!activeBrandId) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select a brand from the sidebar to start creating videos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <VideoModeSelector mode={mode} onModeChange={setMode} />

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Main panel */}
        <div className="rounded-xl border border-border bg-card/50 p-5">
          {mode === 'create' && (
            <VideoCreatePanel brand={data.brand} strategyContext={strategyContext} />
          )}
          {mode === 'edit' && (
            <VideoEditPanel brand={data.brand} strategyContext={strategyContext} />
          )}
          {mode === 'import' && (
            <VideoImportPanel brand={data.brand} />
          )}
        </div>

        {/* Side panel — exporter (visible in create and edit modes) */}
        {(mode === 'create' || mode === 'edit') && (
          <div>
            <VideoExporter brand={data.brand} />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/video/VideoRoom.tsx
git commit -m "feat: VideoRoom composite component assembling all video panels"
```

---

### Task 8: Wire VideoRoom into Route Page

**Files:**
- Edit: `src/app/agency/studio/video/page.tsx`

- [ ] **Step 1: Replace the stub with the real component**

Replace the entire contents of `src/app/agency/studio/video/page.tsx` with:

```typescript
'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { VideoRoom } from '@/components/agency/studio/video/VideoRoom'

export default function VideoRoomPage() {
  return (
    <RoomLayout title="Video Room">
      <VideoRoom />
    </RoomLayout>
  )
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npx next build --no-lint 2>&1 | tail -20
```

If there are import errors, fix them before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/app/agency/studio/video/page.tsx
git commit -m "feat: wire VideoRoom into /agency/studio/video route"
```

---

## DESIGN ROOM

### Task 9: DesignModeSelector Component

**Files:**
- Create: `src/components/agency/studio/design/DesignModeSelector.tsx`

- [ ] **Step 1: Create the mode selector with 3 tabs**

```typescript
'use client'

import { Sparkles, LayoutGrid, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DesignMode = 'create' | 'browse' | 'upload'

interface DesignModeSelectorProps {
  mode: DesignMode
  onModeChange: (mode: DesignMode) => void
}

const MODES = [
  {
    id: 'create' as const,
    icon: Sparkles,
    label: 'Create',
    description: 'AI designs it for you',
  },
  {
    id: 'browse' as const,
    icon: LayoutGrid,
    label: 'Browse',
    description: 'Your Canva designs',
  },
  {
    id: 'upload' as const,
    icon: Upload,
    label: 'Upload',
    description: 'Your own images',
  },
]

export function DesignModeSelector({ mode, onModeChange }: DesignModeSelectorProps) {
  return (
    <div className="flex gap-2">
      {MODES.map(m => {
        const Icon = m.icon
        const active = mode === m.id
        return (
          <button
            key={m.id}
            onClick={() => onModeChange(m.id)}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-all',
              active
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium">{m.label}</div>
              <div className="text-[10px] opacity-70">{m.description}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/design/DesignModeSelector.tsx
git commit -m "feat: DesignModeSelector component with 3 tabs"
```

---

### Task 10: DesignCreatePanel — AI Generation

**Files:**
- Create: `src/components/agency/studio/design/DesignCreatePanel.tsx`

Prompt input, format selector, "Generate" button that sends to Director. Director delegates to Brand agent which uses the `design_graphic` tool (Canva API).

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { Sparkles, Wand2, Loader2 } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'
import type { StrategyContext } from '@/hooks/useStrategyContext'

interface DesignCreatePanelProps {
  brand: Brand | null
  strategyContext: StrategyContext | null
}

type DesignFormat =
  | 'instagram_post'
  | 'instagram_story'
  | 'facebook_post'
  | 'linkedin_post'
  | 'tiktok_video'
  | 'youtube_thumbnail'
  | 'a4_document'

const FORMATS: { id: DesignFormat; label: string; dimensions: string }[] = [
  { id: 'instagram_post', label: 'IG Post', dimensions: '1080x1080' },
  { id: 'instagram_story', label: 'IG Story', dimensions: '1080x1920' },
  { id: 'facebook_post', label: 'Facebook', dimensions: '1200x630' },
  { id: 'linkedin_post', label: 'LinkedIn', dimensions: '1200x627' },
  { id: 'tiktok_video', label: 'TikTok', dimensions: '1080x1920' },
  { id: 'youtube_thumbnail', label: 'YT Thumbnail', dimensions: '1280x720' },
  { id: 'a4_document', label: 'A4', dimensions: '595x842' },
]

export function DesignCreatePanel({ brand, strategyContext }: DesignCreatePanelProps) {
  const [prompt, setPrompt] = useState('')
  const [format, setFormat] = useState<DesignFormat>('instagram_post')
  const [sending, setSending] = useState(false)

  const handleGenerate = () => {
    if (!brand) return
    setSending(true)

    const selectedFormat = FORMATS.find(f => f.id === format)
    const message = [
      `Design a ${selectedFormat?.label ?? format} graphic for ${brand.name}.`,
      prompt.trim()
        ? `Design brief: "${prompt.trim()}"`
        : 'Choose the best design based on the strategy context.',
      `Format: ${format} (${selectedFormat?.dimensions}).`,
      'Use the brand kit if available. Create it in Canva, then show me the result.',
      '',
      strategyContext?.agentContext ?? '',
    ].filter(Boolean).join('\n')

    sendToDirector(message)
    setTimeout(() => setSending(false), 1500)
  }

  const handleLetAIChoose = () => {
    if (!brand) return
    setSending(true)

    sendToDirector(
      [
        `Suggest and create the best graphic design for ${brand.name} right now based on the strategy.`,
        'Consider which platform needs content and what visual would support the next post.',
        'Create it in Canva using the brand kit.',
        '',
        strategyContext?.agentContext ?? '',
      ].filter(Boolean).join('\n')
    )
    setTimeout(() => setSending(false), 1500)
  }

  return (
    <div className="space-y-6">
      {/* Prompt input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">What do you need designed?</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. Announcement post for new telehealth booking feature"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
          />
          <button
            onClick={handleLetAIChoose}
            disabled={sending || !brand}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:border-primary/30 hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Let AI choose
          </button>
        </div>
      </div>

      {/* Format selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Format</label>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(f => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-lg border px-3 py-2 text-xs transition-all ${
                format === f.id
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              }`}
            >
              <div className="font-medium">{f.label}</div>
              <div className="text-[9px] opacity-60">{f.dimensions}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={sending || !brand}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending to Director...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Generate Design
          </>
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/design/DesignCreatePanel.tsx
git commit -m "feat: DesignCreatePanel with prompt input and format selector"
```

---

### Task 11: DesignBrowsePanel — Canva Gallery

**Files:**
- Create: `src/components/agency/studio/design/DesignBrowsePanel.tsx`

Grid of designs fetched from `/api/canva/designs` (already working). Click to preview, "Edit in Canva" opens `edit_url`, "Export" calls the Director to use the `export_design` tool, "Use in post" sends to Post Composer.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useEffect } from 'react'
import { ExternalLink, Download, PenLine, Loader2, ImageOff, RefreshCw } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'

interface CanvaDesign {
  id: string
  title: string
  thumbnail_url: string | null
  edit_url: string | null
  view_url: string | null
  updated_at: string | null
}

interface DesignBrowsePanelProps {
  brand: Brand | null
}

export function DesignBrowsePanel({ brand }: DesignBrowsePanelProps) {
  const [designs, setDesigns] = useState<CanvaDesign[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDesign, setSelectedDesign] = useState<CanvaDesign | null>(null)

  const fetchDesigns = async () => {
    if (!brand) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/canva/designs?brandId=${brand.id}`)
      const data = await res.json()

      setConfigured(data.configured !== false)
      setDesigns(data.designs ?? [])
      if (data.error) setError(data.error)
    } catch {
      setError('Failed to load designs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDesigns()
  }, [brand?.id])

  const handleExport = (design: CanvaDesign) => {
    sendToDirector(
      `Export the Canva design "${design.title}" (ID: ${design.id}) as PNG. Save it to the media library for ${brand?.name ?? 'this brand'}.`
    )
  }

  const handleUseInPost = (design: CanvaDesign) => {
    sendToDirector(
      `Write a social media post for ${brand?.name ?? 'this brand'} to accompany the design "${design.title}". The design is ready in Canva (ID: ${design.id}).`
    )
  }

  if (!configured) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center space-y-3">
        <ImageOff className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Canva not connected. Connect your Canva account to browse designs.
        </p>
        <a
          href="/api/canva/auth"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Connect Canva
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Your Canva Designs ({designs.length})
        </h3>
        <button
          onClick={fetchDesigns}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-xs text-amber-400">{error}</p>
      )}

      {designs.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No designs found. Create one using the Create tab, or open Canva directly.
          </p>
        </div>
      ) : (
        <>
          {/* Design grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {designs.map(design => (
              <button
                key={design.id}
                onClick={() => setSelectedDesign(design)}
                className={`group rounded-xl border overflow-hidden text-left transition-all ${
                  selectedDesign?.id === design.id
                    ? 'border-primary/50 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="aspect-square bg-muted">
                  {design.thumbnail_url ? (
                    <img
                      src={design.thumbnail_url}
                      alt={design.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageOff className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-foreground">{design.title}</p>
                  {design.updated_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(design.updated_at).toLocaleDateString('en-AU')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Selected design actions */}
          {selectedDesign && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <h4 className="text-sm font-medium text-foreground">{selectedDesign.title}</h4>
              <div className="flex flex-wrap gap-2">
                {selectedDesign.edit_url && (
                  <a
                    href={selectedDesign.edit_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-primary/5 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Edit in Canva
                  </a>
                )}
                <button
                  onClick={() => handleExport(selectedDesign)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-primary/5 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </button>
                <button
                  onClick={() => handleUseInPost(selectedDesign)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground hover:bg-primary/5 transition-colors"
                >
                  <PenLine className="h-3.5 w-3.5" />
                  Use in Post
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/design/DesignBrowsePanel.tsx
git commit -m "feat: DesignBrowsePanel with Canva gallery grid, preview, export, and use-in-post actions"
```

---

### Task 12: DesignUploadPanel — Own Assets

**Files:**
- Create: `src/components/agency/studio/design/DesignUploadPanel.tsx`

Drag and drop images to Supabase Storage. Grid of uploaded assets. "Resize for all platforms" button calls Director to use Brand agent.

- [ ] **Step 1: Create the component**

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { Upload, ImageIcon, Loader2, CheckCircle2, Maximize2 } from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Brand } from '@/types/database'

interface UploadedAsset {
  id: string
  file: File
  previewUrl: string
  status: 'uploading' | 'uploaded' | 'error'
  mediaItemId?: string
  error?: string
}

interface DesignUploadPanelProps {
  brand: Brand | null
}

export function DesignUploadPanel({ brand }: DesignUploadPanelProps) {
  const [assets, setAssets] = useState<UploadedAsset[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const updateAsset = (id: string, updates: Partial<UploadedAsset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const uploadFile = async (asset: UploadedAsset) => {
    if (!brand) return

    try {
      const formData = new FormData()
      formData.append('file', asset.file)
      formData.append('brandId', brand.id)

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      updateAsset(asset.id, {
        status: 'uploaded',
        mediaItemId: data.mediaItem?.id ?? data.id,
      })
    } catch (err) {
      updateAsset(asset.id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      })
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('image/')
    )

    const newAssets: UploadedAsset[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: 'uploading' as const,
    }))

    setAssets(prev => [...prev, ...newAssets])
    await Promise.allSettled(newAssets.map(a => uploadFile(a)))
  }, [brand])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f =>
      f.type.startsWith('image/')
    )

    const newAssets: UploadedAsset[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      previewUrl: URL.createObjectURL(f),
      status: 'uploading' as const,
    }))

    setAssets(prev => [...prev, ...newAssets])
    await Promise.allSettled(newAssets.map(a => uploadFile(a)))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleResizeAll = () => {
    if (!brand) return
    const selected = assets.filter(a => selectedIds.has(a.id) && a.status === 'uploaded')
    if (selected.length === 0) return

    sendToDirector(
      `Resize these ${selected.length} uploaded image(s) for all social media platforms (IG Post 1080x1080, IG Story 1080x1920, FB 1200x630, LinkedIn 1200x627, TikTok 1080x1920, YT Thumbnail 1280x720) for ${brand.name}. Apply the brand overlay (logo, colours) if available.\n\nMedia item IDs: ${selected.map(a => a.mediaItemId).filter(Boolean).join(', ')}`
    )
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      assets.forEach(a => URL.revokeObjectURL(a.previewUrl))
    }
  }, [])

  const uploadedCount = assets.filter(a => a.status === 'uploaded').length

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors ${
          isDragOver
            ? 'border-primary/50 bg-primary/5'
            : 'border-border text-muted-foreground hover:border-primary/30'
        }`}
      >
        <Upload className="h-10 w-10" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Drop images here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, JPG, SVG, WebP
          </p>
        </div>
        <label className="cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-xs text-foreground hover:bg-primary/5 transition-colors">
          Browse files
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
      </div>

      {/* Asset grid */}
      {assets.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Uploaded ({uploadedCount})
            </h3>
            {selectedIds.size > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selected
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {assets.map(asset => (
              <button
                key={asset.id}
                onClick={() => asset.status === 'uploaded' && toggleSelect(asset.id)}
                disabled={asset.status !== 'uploaded'}
                className={`group relative rounded-xl border overflow-hidden aspect-square transition-all ${
                  selectedIds.has(asset.id)
                    ? 'border-primary/50 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <img
                  src={asset.previewUrl}
                  alt={asset.file.name}
                  className="h-full w-full object-cover"
                />
                {asset.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                )}
                {asset.status === 'uploaded' && selectedIds.has(asset.id) && (
                  <div className="absolute top-1.5 right-1.5">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  </div>
                )}
                {asset.status === 'error' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                    <span className="text-[10px] text-red-400">{asset.error}</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resize for all platforms button */}
      {selectedIds.size > 0 && (
        <button
          onClick={handleResizeAll}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Maximize2 className="h-4 w-4" />
          Resize for All Platforms ({selectedIds.size} image{selectedIds.size !== 1 ? 's' : ''})
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/design/DesignUploadPanel.tsx
git commit -m "feat: DesignUploadPanel with drag-and-drop image upload and multi-platform resize"
```

---

### Task 13: DesignRoom Component — Assembles Everything

**Files:**
- Create: `src/components/agency/studio/design/DesignRoom.tsx`

- [ ] **Step 1: Create the composite component**

```typescript
'use client'

import { useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { DesignModeSelector, type DesignMode } from './DesignModeSelector'
import { DesignCreatePanel } from './DesignCreatePanel'
import { DesignBrowsePanel } from './DesignBrowsePanel'
import { DesignUploadPanel } from './DesignUploadPanel'

export function DesignRoom() {
  const [mode, setMode] = useState<DesignMode>('create')
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  if (!activeBrandId) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select a brand from the sidebar to start designing.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DesignModeSelector mode={mode} onModeChange={setMode} />

      <div className="rounded-xl border border-border bg-card/50 p-5">
        {mode === 'create' && (
          <DesignCreatePanel brand={data.brand} strategyContext={strategyContext} />
        )}
        {mode === 'browse' && (
          <DesignBrowsePanel brand={data.brand} />
        )}
        {mode === 'upload' && (
          <DesignUploadPanel brand={data.brand} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/agency/studio/design/DesignRoom.tsx
git commit -m "feat: DesignRoom composite component assembling all design panels"
```

---

### Task 14: Wire DesignRoom into Route Page

**Files:**
- Edit: `src/app/agency/studio/design/page.tsx`

- [ ] **Step 1: Replace the stub with the real component**

Replace the entire contents of `src/app/agency/studio/design/page.tsx` with:

```typescript
'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { DesignRoom } from '@/components/agency/studio/design/DesignRoom'

export default function DesignRoomPage() {
  return (
    <RoomLayout title="Design Room">
      <DesignRoom />
    </RoomLayout>
  )
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npx next build --no-lint 2>&1 | tail -20
```

If there are import errors, fix them before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/app/agency/studio/design/page.tsx
git commit -m "feat: wire DesignRoom into /agency/studio/design route"
```

---

### Task 15: Build Verification + Final Push

- [ ] **Step 1: Run the full build**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm run build 2>&1 | tail -30
```

Fix any TypeScript or build errors.

- [ ] **Step 2: Run lint**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm run lint 2>&1 | tail -20
```

Fix any lint errors.

- [ ] **Step 3: Quick manual test**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && npm run dev &
# Visit http://localhost:3000/agency/studio/video — should show 3 tabs with full UI
# Visit http://localhost:3000/agency/studio/design — should show 3 tabs with full UI
# Kill dev server when done
```

- [ ] **Step 4: Push to main**

```bash
cd /Users/jb-downscale/NotRealSmartAgency && git push origin main
```

---

## File Summary

### New Files (13)

| File | Purpose |
|------|---------|
| `src/components/agency/studio/video/VideoModeSelector.tsx` | 3-tab selector: Create / Edit / Import |
| `src/components/agency/studio/video/VideoCreatePanel.tsx` | AI video generation (topic, provider, format, sendToDirector) |
| `src/components/agency/studio/video/VideoEditPanel.tsx` | Manual editing (import, preview, trim, AI assist) |
| `src/components/agency/studio/video/VideoImportPanel.tsx` | Bulk C.A.M. (drag-drop, auto-transcribe, batch captions) |
| `src/components/agency/studio/video/VideoExporter.tsx` | Export + schedule (platform formats, date/time, save/schedule/publish) |
| `src/components/agency/studio/video/VideoRoom.tsx` | Composite: mode selector + panel + exporter |
| `src/components/agency/studio/design/DesignModeSelector.tsx` | 3-tab selector: Create / Browse / Upload |
| `src/components/agency/studio/design/DesignCreatePanel.tsx` | AI design generation (prompt, format, sendToDirector) |
| `src/components/agency/studio/design/DesignBrowsePanel.tsx` | Canva gallery (grid, preview, edit/export/use-in-post) |
| `src/components/agency/studio/design/DesignUploadPanel.tsx` | Own assets (drag-drop upload, select, resize for all platforms) |
| `src/components/agency/studio/design/DesignRoom.tsx` | Composite: mode selector + panel |

### Modified Files (2)

| File | Change |
|------|--------|
| `src/app/agency/studio/video/page.tsx` | Replace stub with VideoRoom import |
| `src/app/agency/studio/design/page.tsx` | Replace stub with DesignRoom import |

### New Dependencies

| Package | Purpose |
|---------|---------|
| `@twick/react` + `@twick/core` OR `remotion` + `@remotion/player` | Video timeline editor |
| `@ffmpeg/ffmpeg` + `@ffmpeg/util` | Client-side video processing |

### APIs Used (all existing, no new endpoints needed)

| Endpoint | Used By |
|----------|---------|
| `/api/video/generate` | VideoCreatePanel (via Director -> create_video tool) |
| `/api/video/status` | VideoCreatePanel (status polling) |
| `/api/canva/designs` | DesignBrowsePanel (gallery fetch) |
| `/api/canva/auth` | DesignBrowsePanel (connect button) |
| `/api/media/upload` | VideoEditPanel, VideoImportPanel, DesignUploadPanel |
| `/api/media/transcribe` | VideoImportPanel (auto-transcribe) |

### Communication Pattern

All AI features use `sendToDirector()` from `src/lib/chat-dispatch.ts`. The Director delegates to the appropriate agent (Video agent, Brand agent, Content agent) which uses the corresponding tools (create_video, design_graphic, export_design, process_media). No direct API calls from components to AI — everything goes through the chat panel.
