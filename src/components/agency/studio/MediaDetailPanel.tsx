'use client'

import { useEffect, useState } from 'react'
import {
  X,
  Download,
  Sparkles,
  Repeat,
  Calendar,
  FileText,
  Clock,
  HardDrive,
  Eye,
  Copy,
  Check,
  Plus,
  Music,
  Film,
  PenLine,
  Image as ImageIcon,
} from 'lucide-react'
import { sendToDirector } from '@/lib/chat-dispatch'
import { AltTextDialog } from './media/AltTextDialog'
import type { MediaItemWithUsage } from '@/types/database'

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface MediaDetailPanelProps {
  item: MediaItemWithUsage
  onClose: () => void
  onTagAdd: (id: string, tag: string) => void
  onTagRemove: (id: string, tag: string) => void
  onGenerate: (id: string) => void
  onRepurpose: (id: string) => void
  availableTags: string[]
  onItemUpdated?: (item: MediaItemWithUsage) => void
  /** Re-read the library after a change this panel made to the row. */
  onRefresh?: () => void
}

export function MediaDetailPanel({
  item,
  onClose,
  onTagAdd,
  onTagRemove,
  onGenerate,
  onRepurpose,
  availableTags,
  onItemUpdated,
  onRefresh,
}: MediaDetailPanelProps) {
  const [copied, setCopied] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagValue, setTagValue] = useState('')
  const [fileName, setFileName] = useState(item.file_name)
  const [savingName, setSavingName] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [altDialogOpen, setAltDialogOpen] = useState(false)

  // Keep local name in sync if parent swaps the item.
  useEffect(() => {
    setFileName(item.file_name)
    setNameError(null)
  }, [item.id, item.file_name])

  const isImage = item.file_type?.startsWith('image/')
  const isVideo = item.file_type?.startsWith('video/')
  const isAudio = item.file_type?.startsWith('audio/')
  const tags = item.tags ?? []
  const altText =
    typeof (item.metadata as { alt_text?: unknown } | null)?.alt_text === 'string'
      ? ((item.metadata as { alt_text: string }).alt_text)
      : ''

  const [makingCover, setMakingCover] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)

  /**
   * Ask for a cover frame. Every `media_items` write goes through the one
   * pipeline, so this posts the stage rather than touching the row — a direct
   * update here would be the second place media rows are written, and the
   * first thing to drift.
   */
  const handleMakeCover = async () => {
    setMakingCover(true)
    setCoverError(null)
    try {
      const res = await fetch('/api/media/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaItemId: item.id, runStages: ['thumbnail'] }),
      })
      if (!res.ok) {
        setCoverError('A cover could not be made just now. Nothing has been changed.')
        return
      }
      onRefresh?.()
    } catch {
      setCoverError('A cover could not be made just now. Nothing has been changed.')
    } finally {
      setMakingCover(false)
    }
  }

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(item.file_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleTagSubmit = () => {
    const trimmed = tagValue.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      onTagAdd(item.id, trimmed)
    }
    setTagValue('')
    setShowTagInput(false)
  }

  const handleUseInPost = () => {
    sendToDirector(`Create a social media post using this media: ${item.file_name}. The file is already in my media library.`)
    onClose()
  }

  const persistName = async () => {
    const trimmed = fileName.trim()
    if (!trimmed || trimmed === item.file_name) {
      setFileName(item.file_name)
      return
    }
    setSavingName(true)
    setNameError(null)
    try {
      const res = await fetch('/api/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, file_name: trimmed }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to rename file')
      }
      const updated = await res.json()
      onItemUpdated?.({ ...item, file_name: updated.file_name ?? trimmed })
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to rename file')
      setFileName(item.file_name)
    } finally {
      setSavingName(false)
    }
  }

  const suggestions = availableTags.filter(
    t => !tags.includes(t) && t.toLowerCase().includes(tagValue.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header — file name editable in place */}
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onBlur={persistName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                setFileName(item.file_name)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            disabled={savingName}
            aria-label="File name"
            className="w-full truncate rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-foreground outline-none hover:border-border focus:border-[oklch(0.65_0.12_240)]/60 focus:bg-background"
          />
          {nameError && (
            <p className="mt-1 px-1.5 text-[10px] text-red-400">{nameError}</p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-lg p-1 transition-colors hover:bg-muted"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Preview */}
        <div className="relative bg-black/90">
          {isImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.file_url}
              alt={item.file_name}
              className="mx-auto max-h-[400px] w-full object-contain"
            />
          )}
          {isVideo && (
            <video
              src={item.file_url}
              controls
              className="mx-auto max-h-[400px] w-full"
              poster={item.thumbnail_url ?? undefined}
            />
          )}
          {isAudio && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Music className="h-12 w-12 text-muted-foreground/50" />
              <audio src={item.file_url} controls className="w-full max-w-xs" />
            </div>
          )}
          {!isImage && !isVideo && !isAudio && (
            <div className="flex items-center justify-center py-16">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
        </div>

        <div className="p-4 space-y-5">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleUseInPost}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5" />
              Use in Post
            </button>
            <button
              onClick={() => onGenerate(item.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate Captions
            </button>
            <button
              onClick={() => onRepurpose(item.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 transition-colors"
            >
              <Repeat className="h-3.5 w-3.5" />
              Repurpose
            </button>
          </div>

          {/* AI Description */}
          {item.ai_description && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</h4>
              <p className="text-sm text-foreground leading-relaxed">{item.ai_description}</p>
            </div>
          )}

          {/*
            The description that travels with the picture.

            "Alt text" is a web developer's phrase and this owner is not one, so
            the heading says what it is for. Where it lands is stated too:
            Instagram feed posts, Facebook, Threads, X, LinkedIn, Bluesky and
            Pinterest read it; Reels and Stories have no field for it and
            quietly drop it, which is worth knowing BEFORE writing 400 words
            for a Reel.
          */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Description for screen readers
              </h4>
              <button
                type="button"
                onClick={() => setAltDialogOpen(true)}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <PenLine className="h-3 w-3" />
                {altText ? 'Edit' : 'Add one'}
              </button>
            </div>
            {altText ? (
              <p className="text-xs text-foreground/80 leading-relaxed">{altText}</p>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Nothing yet. Without it, anyone using a screen reader hears silence where this picture is.
              </p>
            )}
            <p className="text-[10px] text-muted-foreground">
              Goes out on Instagram feed posts, Facebook, Threads, X, LinkedIn, Bluesky and Pinterest.
            </p>
          </div>

          {/*
            The cover frame.

            A video published with no cover gets whatever frame the platform
            grabs, which on a talking-head clip is reliably a blink. The frame
            is stored on the row as `thumbnail_url` and the publishing path
            already carries it through as the video and Reel cover, so the only
            thing missing was somewhere to SEE whether one exists, and one
            button to make one when it does not.
          */}
          {isVideo && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Cover picture
                </h4>
                <button
                  type="button"
                  onClick={handleMakeCover}
                  disabled={makingCover}
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <PenLine className="h-3 w-3" />
                  {makingCover ? 'Working…' : item.thumbnail_url ? 'Take a fresh one' : 'Make one'}
                </button>
              </div>
              {item.thumbnail_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.thumbnail_url}
                    alt=""
                    className="h-24 w-auto rounded-md border border-border object-cover"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Shown as the still frame before anyone presses play.
                  </p>
                </>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  None yet — the platform will pick a frame for you, and it is usually a bad one.
                </p>
              )}
              {coverError ? (
                <p className="text-[10px]" style={{ color: 'var(--stop, oklch(0.55 0.17 27))' }}>
                  {coverError}
                </p>
              ) : null}
            </div>
          )}

          {/* Transcription */}
          {item.transcription && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Transcription</h4>
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{item.transcription}</p>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</h4>
            <div className="flex flex-wrap gap-1.5">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="group inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground"
                >
                  {tag}
                  <button
                    onClick={() => onTagRemove(item.id, tag)}
                    className="hidden group-hover:inline-flex rounded-full hover:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {showTagInput ? (
                <div className="relative">
                  <input
                    type="text"
                    value={tagValue}
                    onChange={e => setTagValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleTagSubmit()
                      if (e.key === 'Escape') { setShowTagInput(false); setTagValue('') }
                    }}
                    onBlur={() => { if (!tagValue) setShowTagInput(false) }}
                    autoFocus
                    placeholder="Add tag..."
                    className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] w-24 outline-none focus:border-primary"
                  />
                  {tagValue && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 z-10 rounded-lg border border-border bg-background shadow-lg py-1 w-32">
                      {suggestions.slice(0, 5).map(s => (
                        <button
                          key={s}
                          onMouseDown={e => { e.preventDefault(); onTagAdd(item.id, s); setTagValue(''); setShowTagInput(false) }}
                          className="block w-full px-2 py-1 text-left text-[11px] hover:bg-muted"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowTagInput(true)}
                  className="inline-flex items-center rounded-full bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3 mr-0.5" />
                  Add
                </button>
              )}
            </div>
          </div>

          {/* File Details */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {isImage && <ImageIcon className="h-3.5 w-3.5" />}
                {isVideo && <Film className="h-3.5 w-3.5" />}
                {isAudio && <Music className="h-3.5 w-3.5" />}
                {!isImage && !isVideo && !isAudio && <FileText className="h-3.5 w-3.5" />}
                <span>{item.file_type?.split('/')[1]?.toUpperCase() ?? 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <HardDrive className="h-3.5 w-3.5" />
                <span>{formatFileSize(item.file_size_bytes)}</span>
              </div>
              {item.duration_seconds && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{formatDuration(item.duration_seconds)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Eye className="h-3.5 w-3.5" />
                <span>{item.usage_count > 0 ? `Used ${item.usage_count}x` : 'Not used'}</span>
              </div>
              <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{item.file_created_at ? formatDate(item.file_created_at) : formatDate(item.created_at)}</span>
              </div>
              {item.uploaded_by_name && (
                <div className="col-span-2 text-muted-foreground">
                  Uploaded by {item.uploaded_by_name}
                </div>
              )}
              {item.brands?.name && (
                <div className="col-span-2 text-muted-foreground">
                  Brand: {item.brands.name}
                </div>
              )}
            </div>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyUrl}
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy URL'}
              </button>
              <a
                href={item.file_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Download className="h-3 w-3" />
                Download
              </a>
            </div>
          </div>
        </div>
      </div>

      <AltTextDialog
        item={item}
        open={altDialogOpen}
        onOpenChange={setAltDialogOpen}
        onSaved={(updated) => {
          onItemUpdated?.({ ...item, metadata: updated.metadata })
        }}
      />
    </div>
  )
}
