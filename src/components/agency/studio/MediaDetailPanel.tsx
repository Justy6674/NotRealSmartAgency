'use client'

import { useState } from 'react'
import {
  X,
  Download,
  Sparkles,
  Repeat,
  Calendar,
  Tag,
  FileText,
  Clock,
  HardDrive,
  Eye,
  Copy,
  Check,
  Plus,
  Music,
  Film,
  Image as ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendToDirector } from '@/lib/chat-dispatch'
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
}

export function MediaDetailPanel({
  item,
  onClose,
  onTagAdd,
  onTagRemove,
  onGenerate,
  onRepurpose,
  availableTags,
}: MediaDetailPanelProps) {
  const [copied, setCopied] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagValue, setTagValue] = useState('')

  const isImage = item.file_type?.startsWith('image/')
  const isVideo = item.file_type?.startsWith('video/')
  const isAudio = item.file_type?.startsWith('audio/')
  const tags = item.tags ?? []

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

  const suggestions = availableTags.filter(
    t => !tags.includes(t) && t.toLowerCase().includes(tagValue.toLowerCase())
  )

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground truncate pr-4">
          {item.file_name}
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 hover:bg-muted transition-colors"
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
    </div>
  )
}
