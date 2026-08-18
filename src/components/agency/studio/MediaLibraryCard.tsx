'use client'

import { useState, useRef, useEffect } from 'react'
import {
  CheckCircle2,
  Archive,
  ArchiveRestore,
  Trash2,
  Sparkles,
  Repeat,
  Plus,
  X,
  Music,
  Loader2,
  ChevronDown,
  RefreshCw,
} from 'lucide-react'
import type { MediaItemWithUsage } from '@/types/database'
import { formatFileSize } from '@/lib/media/format-file-size'

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

const VISIBLE_TAG_COUNT = 2

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
  onCreatePost?: (id: string) => void
  onRegenerateThumb?: (id: string) => void
  regeneratingThumb?: boolean
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
  onCreatePost,
  onRegenerateThumb,
  regeneratingThumb,
  availableTags,
}: MediaLibraryCardProps) {
  const [decodeFailed, setDecodeFailed] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagsExpanded, setTagsExpanded] = useState(false)
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

  useEffect(() => {
    if (!showGenerateMenu) return
    const close = (event: MouseEvent) => {
      if (
        generateMenuRef.current &&
        !generateMenuRef.current.contains(event.target as Node)
      ) {
        setShowGenerateMenu(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showGenerateMenu])

  const existingTags = item.tags ?? []
  const visibleTags = tagsExpanded
    ? existingTags
    : existingTags.slice(0, VISIBLE_TAG_COUNT)
  const hiddenTagCount = Math.max(0, existingTags.length - VISIBLE_TAG_COUNT)
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
      className={`relative flex flex-col rounded-[12px] border transition-all ${
        item.is_archived ? 'opacity-60' : ''
      } ${selected ? 'ring-2 ring-[var(--brand-deep,oklch(0.33_0.08_240))]' : ''}`}
      style={{
        background: 'var(--panel, oklch(1 0 0))',
        borderColor: selected
          ? 'var(--brand-deep, oklch(0.33 0.08 240))'
          : 'var(--line, oklch(0.915 0.007 240))',
        color: 'var(--ink, oklch(0.20 0.014 240))',
        boxShadow: selected
          ? undefined
          : 'var(--nrs-shadow, 0 1px 2px oklch(0.2 0.02 240 / .05))',
      }}
    >
      {item.is_archived && (
        <div
          className="absolute right-2 top-2 z-10 rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            background: 'var(--panel-2, oklch(0.975 0.004 240))',
            color: 'var(--ink-3, oklch(0.615 0.011 240))',
          }}
        >
          Archived
        </div>
      )}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onSelect(item.id)
        }}
        className="absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded-full border transition-colors"
        style={{
          borderColor: selected
            ? 'var(--brand-deep, oklch(0.33 0.08 240))'
            : 'var(--line, oklch(0.915 0.007 240))',
          background: selected
            ? 'var(--brand-deep, oklch(0.33 0.08 240))'
            : 'var(--panel, oklch(1 0 0))',
          color: selected
            ? 'var(--brand-ink, oklch(1 0 0))'
            : 'var(--ink-3, oklch(0.615 0.011 240))',
        }}
        aria-pressed={selected}
        aria-label={selected ? 'Deselect clip' : 'Select clip'}
      >
        {selected ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      </button>

      <div
        className="relative h-40 w-full shrink-0 cursor-pointer overflow-hidden rounded-t-[12px]"
        style={{ background: 'var(--panel-2, oklch(0.975 0.004 240))' }}
        onClick={() => onClick?.(item)}
      >
        {decodeFailed ? (
          <div
            className="flex h-full items-center justify-center px-3 text-center text-[11px]"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          >
            This file didn’t save. Upload it again.
          </div>
        ) : item.file_type.startsWith('image/') ? (
          <img
            src={item.thumbnail_url || item.file_url}
            alt={item.file_name}
            className="h-40 w-full object-cover"
            onError={() => setDecodeFailed(true)}
          />
        ) : item.file_type.startsWith('video/') ? (
          item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt={item.file_name}
              className="h-40 w-full object-cover"
              onError={() => setDecodeFailed(true)}
            />
          ) : (
            <div
              className="flex h-full items-center justify-center text-[11px]"
              style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
            >
              Picture not ready yet
            </div>
          )
        ) : (
          <div className="flex h-full items-center justify-center">
            <Music
              className="h-10 w-10"
              style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
            />
          </div>
        )}

        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {item.duration_seconds != null && (
            <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {item.duration_seconds >= 60
                ? `${Math.floor(item.duration_seconds / 60)}:${String(Math.floor(item.duration_seconds % 60)).padStart(2, '0')}`
                : `${Math.floor(item.duration_seconds)}s`}
            </span>
          )}
          {(() => {
            const va = (item.metadata as Record<string, unknown>)?.visual_analysis as
              | { recommended_format?: string }
              | undefined
            if (!va?.recommended_format || va.recommended_format === 'either') return null
            return (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                style={{
                  background:
                    va.recommended_format === 'short'
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

      <div
        className="relative z-10 flex flex-1 flex-col gap-2 p-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onClick?.(item)}
            className="line-clamp-1 text-left text-sm font-medium transition-colors hover:text-[var(--brand-deep,oklch(0.33_0.08_240))]"
          >
            {item.file_name}
          </button>
          <span
            className="shrink-0 text-[10px]"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          >
            {decodeFailed && item.file_size_bytes === 0
              ? ''
              : formatFileSize(item.file_size_bytes)}
          </span>
        </div>

        {item.ai_description && !decodeFailed && (
          <p
            className="line-clamp-2 text-[11px]"
            style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))' }}
          >
            {item.ai_description}
          </p>
        )}

        <div className="flex min-h-[22px] flex-wrap items-center gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag}
              className="group inline-flex max-w-[9rem] items-center gap-0.5 truncate rounded-full px-2 py-0.5 text-[10px]"
              style={{
                background: 'var(--panel-2, oklch(0.975 0.004 240))',
                color: 'var(--ink-2, oklch(0.46 0.012 240))',
              }}
            >
              <button
                type="button"
                onClick={() => onTagClick(tag)}
                className="truncate hover:text-[var(--ink,oklch(0.20_0.014_240))]"
              >
                {tag}
              </button>
              <button
                type="button"
                onClick={() => onTagRemove(item.id, tag)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}

          {!tagsExpanded && hiddenTagCount > 0 && (
            <button
              type="button"
              onClick={() => setTagsExpanded(true)}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: 'var(--panel-2, oklch(0.975 0.004 240))',
                color: 'var(--ink-3, oklch(0.615 0.011 240))',
              }}
            >
              +{hiddenTagCount} more
            </button>
          )}

          {tagsExpanded && hiddenTagCount > 0 && (
            <button
              type="button"
              onClick={() => setTagsExpanded(false)}
              className="rounded-full px-2 py-0.5 text-[10px]"
              style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
            >
              Less
            </button>
          )}

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
                className="h-5 w-20 rounded border px-1.5 text-[10px] focus:outline-none focus:ring-1"
                style={{
                  borderColor: 'var(--line, oklch(0.915 0.007 240))',
                  background: 'var(--panel, oklch(1 0 0))',
                  color: 'var(--ink, oklch(0.20 0.014 240))',
                }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <div
                  className="absolute left-0 top-full z-30 mt-0.5 max-h-28 w-32 overflow-y-auto rounded border shadow-md"
                  style={{
                    borderColor: 'var(--line, oklch(0.915 0.007 240))',
                    background: 'var(--panel, oklch(1 0 0))',
                  }}
                >
                  {suggestions.slice(0, 8).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={() => {
                        onTagAdd(item.id, s)
                        setTagValue('')
                        setShowTagInput(false)
                        setShowSuggestions(false)
                      }}
                      className="block w-full px-2 py-1 text-left text-[10px] hover:bg-[var(--panel-2,oklch(0.975_0.004_240))]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowTagInput(true)}
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px]"
              style={{
                background: 'var(--panel-2, oklch(0.975 0.004 240))',
                color: 'var(--ink-3, oklch(0.615 0.011 240))',
              }}
              title="Add tag"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        <div
          className="flex items-center gap-1.5 text-[10px]"
          style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
        >
          {item.usage_count > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-[var(--ok,oklch(0.55_0.13_155))]">
              <CheckCircle2 className="h-3 w-3" />
              Published {item.usage_count}&times;
            </span>
          ) : (
            <span>Not used</span>
          )}
          <span>|</span>
          <span>{dateLabel}</span>
        </div>

        {item.uploaded_by_name && (
          <p
            className="text-[10px]"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          >
            Uploaded by {item.uploaded_by_name}
          </p>
        )}

        <div className="relative z-20 mt-auto flex flex-wrap items-center gap-1 pt-1">
          {!decodeFailed && onCreatePost && (
            <button
              type="button"
              onClick={() => onCreatePost(item.id)}
              className="inline-flex items-center gap-1 rounded-[8px] px-2 py-1 text-[10px] font-semibold transition-colors hover:opacity-90"
              style={{
                background: 'var(--brand-deep, oklch(0.33 0.08 240))',
                color: 'var(--brand-ink, oklch(1 0 0))',
              }}
              title="Start your post with this media"
            >
              <Plus className="h-3 w-3" />
              Post
            </button>
          )}

          {!decodeFailed && (
            <div className="relative" ref={generateMenuRef}>
              <div className="inline-flex">
                <button
                  type="button"
                  onClick={() => {
                    if (!generating) onGenerate(item.id)
                  }}
                  disabled={generating}
                  className="inline-flex items-center gap-1 rounded-l-[8px] border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50"
                  style={{
                    borderColor: 'var(--line, oklch(0.915 0.007 240))',
                    background: 'var(--panel, oklch(1 0 0))',
                    color: 'var(--ink, oklch(0.20 0.014 240))',
                  }}
                  title="Generate captions (auto-detect type)"
                >
                  {generating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {generating ? 'Generating…' : 'Generate'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGenerateMenu((open) => !open)}
                  disabled={generating}
                  className="inline-flex items-center rounded-r-[8px] border border-l-0 px-1 py-1 text-[10px] transition-colors disabled:opacity-50"
                  style={{
                    borderColor: 'var(--line, oklch(0.915 0.007 240))',
                    background: 'var(--panel, oklch(1 0 0))',
                    color: 'var(--ink, oklch(0.20 0.014 240))',
                  }}
                  title="Choose content type"
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              {showGenerateMenu && (
                <div
                  className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border py-1 shadow-lg"
                  style={{
                    borderColor: 'var(--line, oklch(0.915 0.007 240))',
                    background: 'var(--panel, oklch(1 0 0))',
                  }}
                >
                  {CONTENT_TYPES.map((ct) => (
                    <button
                      key={ct.value}
                      type="button"
                      onClick={() => {
                        setShowGenerateMenu(false)
                        onGenerate(item.id, ct.value || undefined)
                      }}
                      className="block w-full px-3 py-1.5 text-left text-[11px] hover:bg-[var(--panel-2,oklch(0.975_0.004_240))]"
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {onRegenerateThumb && item.file_type.startsWith('video/') && (
            <button
              type="button"
              onClick={() => onRegenerateThumb(item.id)}
              disabled={regeneratingThumb}
              className="inline-flex items-center gap-1 rounded-[8px] border px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50"
              style={{
                borderColor: 'var(--line, oklch(0.915 0.007 240))',
                background: 'var(--panel, oklch(1 0 0))',
                color: 'var(--ink, oklch(0.20 0.014 240))',
              }}
              title="Make a new picture from this video"
            >
              {regeneratingThumb ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => onRepurpose(item.id)}
            className="inline-flex items-center rounded-[8px] border p-1 transition-colors"
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel, oklch(1 0 0))',
              color: 'var(--ink-3, oklch(0.615 0.011 240))',
            }}
            title="Repurpose"
          >
            <Repeat className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() =>
              item.is_archived ? onUnarchive(item.id) : onArchive(item.id)
            }
            className="inline-flex items-center rounded-[8px] border p-1 transition-colors"
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel, oklch(1 0 0))',
              color: 'var(--ink-3, oklch(0.615 0.011 240))',
            }}
            title={item.is_archived ? 'Unarchive' : 'Archive'}
          >
            {item.is_archived ? (
              <ArchiveRestore className="h-3 w-3" />
            ) : (
              <Archive className="h-3 w-3" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="inline-flex items-center rounded-[8px] border p-1 transition-colors hover:text-[var(--stop,oklch(0.55_0.17_27))]"
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel, oklch(1 0 0))',
              color: 'var(--ink-3, oklch(0.615 0.011 240))',
            }}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
