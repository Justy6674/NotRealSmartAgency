'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, ChevronDown, Tag } from 'lucide-react'

type TypeFilter = 'all' | 'image' | 'video' | 'audio'
type SortOption = 'newest' | 'oldest' | 'name' | 'most_used'

interface MediaLibraryFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  typeFilter: TypeFilter
  onTypeFilterChange: (value: TypeFilter) => void
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
  availableTags: string[]
  sort: SortOption
  onSortChange: (value: SortOption) => void
  showArchived: boolean
  onShowArchivedChange: (value: boolean) => void
}

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
]

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'most_used', label: 'Most used' },
]

const ink3 = 'var(--ink-3, oklch(0.615 0.011 240))'
const ink2 = 'var(--ink-2, oklch(0.46 0.012 240))'
const ink = 'var(--ink, oklch(0.20 0.014 240))'
const line = 'var(--line, oklch(0.915 0.007 240))'
const panel = 'var(--panel, oklch(1 0 0))'
const panel2 = 'var(--panel-2, oklch(0.975 0.004 240))'
const brandDeep = 'var(--brand-deep, oklch(0.33 0.08 240))'
const brandWash = 'var(--brand-wash, oklch(0.966 0.026 240))'
const brandInk = 'var(--brand-ink, oklch(1 0 0))'

function TagsPopover({
  availableTags,
  selectedTags,
  onSelectedTagsChange,
}: {
  availableTags: string[]
  selectedTags: string[]
  onSelectedTagsChange: (tags: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = (tag: string) => {
    onSelectedTagsChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag],
    )
  }

  const label =
    selectedTags.length === 0
      ? 'Tags'
      : selectedTags.length === 1
        ? selectedTags[0]
        : `${selectedTags.length} tags`

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:border-[var(--brand,oklch(0.545_0.115_240))] hover:text-[var(--brand-deep,oklch(0.33_0.08_240))]"
        style={{
          borderColor: selectedTags.length ? brandDeep : line,
          background: selectedTags.length ? brandWash : panel,
          color: selectedTags.length ? brandDeep : ink2,
        }}
      >
        <Tag className="h-3.5 w-3.5" aria-hidden />
        <span className="max-w-[120px] truncate">{label}</span>
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-56 overflow-hidden rounded-lg border shadow-lg"
          style={{ borderColor: line, background: panel }}
        >
          <div
            className="flex items-center justify-between border-b px-3 py-2"
            style={{ borderColor: line }}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: ink3 }}>
              Filter by tag
            </span>
            {selectedTags.length > 0 ? (
              <button
                type="button"
                onClick={() => onSelectedTagsChange([])}
                className="text-[11px] font-medium hover:underline"
                style={{ color: brandDeep }}
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="max-h-48 overflow-y-auto p-1.5">
            {availableTags.length === 0 ? (
              <p className="px-2 py-3 text-[12px]" style={{ color: ink3 }}>
                No tags yet
              </p>
            ) : (
              availableTags.map((tag) => {
                const on = selectedTags.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggle(tag)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors"
                    style={{
                      background: on ? brandWash : 'transparent',
                      color: on ? brandDeep : ink2,
                    }}
                  >
                    <span
                      className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px]"
                      style={{
                        borderColor: on ? brandDeep : line,
                        background: on ? brandDeep : panel,
                        color: on ? brandInk : 'transparent',
                      }}
                    >
                      {on ? '✓' : ''}
                    </span>
                    <span className="truncate">{tag}</span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function MediaLibraryFilters({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  selectedTags,
  onSelectedTagsChange,
  availableTags,
  sort,
  onSortChange,
  showArchived,
  onShowArchivedChange,
}: MediaLibraryFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setLocalSearch(search)
  }, [search])

  const handleSearchInput = (value: string) => {
    setLocalSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearchChange(value)
    }, 300)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
          style={{ color: ink3 }}
          aria-hidden
        />
        <input
          type="text"
          placeholder="Search filenames or transcriptions"
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="h-9 w-full rounded-lg border pl-9 pr-8 text-[13px] outline-none focus:border-[var(--brand,oklch(0.545_0.115_240))]"
          style={{
            borderColor: line,
            background: panel,
            color: ink,
          }}
        />
        {localSearch ? (
          <button
            type="button"
            onClick={() => {
              setLocalSearch('')
              onSearchChange('')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            style={{ color: ink3 }}
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {TYPE_OPTIONS.map((opt) => {
          const active = typeFilter === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onTypeFilterChange(opt.value)}
              className="rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
              style={{
                borderColor: active ? brandDeep : line,
                background: active ? brandWash : panel,
                color: active ? brandDeep : ink2,
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      <TagsPopover
        availableTags={availableTags}
        selectedTags={selectedTags}
        onSelectedTagsChange={onSelectedTagsChange}
      />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="h-8 rounded-lg border px-2 text-[12px] outline-none"
          style={{ borderColor: line, background: panel, color: ink2 }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label
          className="flex cursor-pointer items-center gap-1.5 text-[12px]"
          style={{ color: ink3 }}
        >
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => onShowArchivedChange(e.target.checked)}
            className="h-3.5 w-3.5 rounded"
          />
          Archived
        </label>
      </div>
    </div>
  )
}
