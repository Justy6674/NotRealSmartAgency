'use client'

import { useState, useRef, useEffect } from 'react'
import {
  CheckCircle2,
  Archive,
  ArchiveRestore,
  Tag,
  Trash2,
  Sparkles,
  Repeat,
  Plus,
  X,
  Music,
  Loader2,
  ChevronDown,
} from 'lucide-react'
import type { MediaItemWithUsage } from '@/types/database'

const CONTENT_TYPES = [
  { value: '', label: 'Auto-detect' },
  { value: 'product showcase', label: 'Product showcase' },
  { value: 'behind the scenes', label: 'Behind the scenes' },
  { value: 'tutorial / how-to', label: 'Tutorial / how-to' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'promotional / sale', label: 'Promotional / sale' },
  { value: 'educational', label: 'Educational' },
  { value: 'event / announcement', label: 'Event / announcement' },
  { value: 'short-form reel', label: 'Short-form Reel / TikTok' },
  { value: 'long-form video', label: 'Long-form video' },
]

interface MediaLibraryCardProps {
  item: MediaItemWithUsage
  selected: boolean
  onSelect: (id: string) => void
  onClick?: (item: MediaItemWithUsage) => void
  onTagAdd: (id: string, tag: string) => void
  onTagRemove: (id: string, tag: string) => void
  onTagClick: (tag: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
  onDelete: (id: string) => void
  onGenerate: (id: string, contentType?: string) => void
  generating?: boolean
  onRepurpose: (id: string) => void
  availableTags: string[]
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
  })
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function MediaLibraryCard({
  item,
  selected,
  onSelect,
  onClick,
  onTagAdd,
  onTagRemove,
  onTagClick,
  onArchive,
  onUnarchive,
  onDelete,
  onGenerate,
  generating,
  onRepurpose,
  availableTags,
}: MediaLibraryCardProps) {
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagValue, setTagValue] = useState('')
  const [showGenerateMenu, setShowGenerateMenu] = useState(false)
  const generateMenuRef = useRef<HTMLDivElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      tagInputRef.current.focus()
    }
  }, [showTagInput])

  const existingTags = item.tags ?? []
  const suggestions = availableTags.filter(
    (t) =>
      !existingTags.includes(t) &&
      t.toLowerCase().includes(tagValue.toLowerCase())
  )

  const handleTagSubmit = () => {
    const trimmed = tagValue.trim().toLowerCase()
    if (trimmed && !existingTags.includes(trimmed)) {
      onTagAdd(item.id, trimmed)
    }
    setTagValue('')
    setShowTagInput(false)
    setShowSuggestions(false)
  }

  const dateLabel = item.file_created_at
    ? `Created ${relativeTime(item.file_created_at)}`
    : `Uploaded ${relativeTime(item.created_at)}`

  return (
    <div
      className={`relative flex flex-col rounded-lg border bg-card text-card-foreground transition-all ${
        item.is_archived ? 'opacity-60' : ''
      } ${selected ? 'ring-2 ring-primary' : ''}`}
    >
      {/* Archive badge */}
      {item.is_archived && (
        <div className="absolute right-2 top-2 z-10 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Archived
        </div>
      )}

      {/* Selection checkbox */}
      <button
        onClick={() => onSelect(item.id)}
        className="absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border bg-background/80 text-foreground transition-colors hover:bg-background"
      >
        {selected && <CheckCircle2 className="h-4 w-4 text-[oklch(0.55_0.1_240)]" />}
      </button>

      {/* Thumbnail — click to open detail */}
      <div
        className="relative h-40 w-full overflow-hidden rounded-t-lg bg-muted cursor-pointer"
        onClick={() => onClick?.(item)}
      >
        {item.file_type.startsWith('image/') ? (
          <img
            src={item.file_url}
            alt={item.file_name}
            className="h-40 w-full object-cover"
          />
        ) : item.file_type.startsWith('video/') ? (
          <video
            src={item.file_url}
            className="h-40 w-full object-cover"
            preload="metadata"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Music className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        {/* Format badge + duration */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {item.duration_seconds != null && (
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {item.duration_seconds >= 60
                ? `${Math.floor(item.duration_seconds / 60)}:${String(Math.floor(item.duration_seconds % 60)).padStart(2, '0')}`
                : `${Math.floor(item.duration_seconds)}s`}
            </span>
          )}
          {(() => {
            const va = (item.metadata as Record<string, unknown>)?.visual_analysis as { recommended_format?: string } | undefined
            if (!va?.recommended_format || va.recommended_format === 'either') return null
            return (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{
                  background: va.recommended_format === 'short'
                    ? 'oklch(0.5 0.15 280)'
                    : 'oklch(0.5 0.12 230)',
                }}
              >
                {va.recommended_format === 'short' ? 'Short' : 'Full'}
              </span>
            )
          })()}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Filename + size */}
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => onClick?.(item)} className="line-clamp-1 text-sm font-medium text-left hover:text-primary transition-colors">{item.file_name}</button>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatFileSize(item.file_size_bytes)}
          </span>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {existingTags.map((tag) => (
            <span
              key={tag}
              className="group inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              <button
                onClick={() => onTagClick(tag)}
                className="hover:text-foreground"
              >
                {tag}
              </button>
              <button
                onClick={() => onTagRemove(item.id, tag)}
                className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}

          {showTagInput ? (
            <div className="relative">
              <input
                ref={tagInputRef}
                type="text"
                value={tagValue}
                onChange={(e) => {
                  setTagValue(e.target.value)
                  setShowSuggestions(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTagSubmit()
                  if (e.key === 'Escape') {
                    setShowTagInput(false)
                    setTagValue('')
                    setShowSuggestions(false)
                  }
                }}
                onBlur={() =>
                  setTimeout(() => {
                    setShowTagInput(false)
                    setTagValue('')
                    setShowSuggestions(false)
                  }, 150)
                }
                placeholder="Add tag..."
                className="h-5 w-20 rounded border border-input bg-background px-1.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 top-full z-20 mt-0.5 max-h-28 w-32 overflow-y-auto rounded border bg-popover shadow-md">
                  {suggestions.slice(0, 8).map((s) => (
                    <button
                      key={s}
                      onMouseDown={() => {
                        onTagAdd(item.id, s)
                        setTagValue('')
                        setShowTagInput(false)
                        setShowSuggestions(false)
                      }}
                      className="block w-full px-2 py-1 text-left text-[10px] hover:bg-muted"
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
              className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* Usage + date */}
        <div className="flex items-center gap-1.5 text-[10px]">
          {item.usage_count > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Published {item.usage_count}&times;
            </span>
          ) : (
            <span className="text-muted-foreground">Not used</span>
          )}
          <span className="text-muted-foreground">|</span>
          <span className="text-muted-foreground">{dateLabel}</span>
        </div>

        {/* Uploaded by */}
        {item.uploaded_by_name && (
          <p className="text-[10px] text-muted-foreground">
            Uploaded by {item.uploaded_by_name}
          </p>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-1 pt-1">
          <div className="relative" ref={generateMenuRef}>
            <div className="inline-flex">
              <button
                onClick={() => generating ? null : onGenerate(item.id)}
                disabled={generating}
                className="inline-flex items-center gap-1 rounded-l-md bg-muted px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                title="Generate captions (auto-detect type)"
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {generating ? 'Generating...' : 'Generate'}
              </button>
              <button
                onClick={() => setShowGenerateMenu(!showGenerateMenu)}
                disabled={generating}
                className="inline-flex items-center rounded-r-md border-l border-background/20 bg-muted px-1 py-1 text-[10px] text-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
                title="Choose content type"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            {showGenerateMenu && (
              <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border border-border bg-card py-1 shadow-lg">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct.value}
                    onClick={() => { setShowGenerateMenu(false); onGenerate(item.id, ct.value || undefined) }}
                    className="block w-full px-3 py-1.5 text-left text-[11px] text-foreground hover:bg-muted transition-colors"
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => onRepurpose(item.id)}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-foreground hover:bg-muted/80 transition-colors"
            title="Repurpose"
          >
            <Repeat className="h-3 w-3" />
          </button>
          <button
            onClick={() =>
              item.is_archived ? onUnarchive(item.id) : onArchive(item.id)
            }
            className="inline-flex items-center rounded-md bg-muted p-1 text-muted-foreground hover:text-foreground transition-colors"
            title={item.is_archived ? 'Unarchive' : 'Archive'}
          >
            {item.is_archived ? (
              <ArchiveRestore className="h-3 w-3" />
            ) : (
              <Archive className="h-3 w-3" />
            )}
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="inline-flex items-center rounded-md bg-muted p-1 text-muted-foreground hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
