'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'

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
    <div className="space-y-3">
      {/* Row 1: Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by filename or transcription..."
          value={localSearch}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {localSearch && (
          <button
            onClick={() => {
              setLocalSearch('')
              onSearchChange('')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Row 2: Type pills + Sort + Archive */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onTypeFilterChange(opt.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === opt.value
                  ? 'bg-[oklch(0.55_0.1_240)] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => onShowArchivedChange(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input"
            />
            Archived
          </label>
        </div>
      </div>

      {/* Row 3: Selected tag pills */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.55_0.1_240)]/10 px-2.5 py-0.5 text-xs font-medium text-[oklch(0.55_0.1_240)]"
            >
              {tag}
              <button
                onClick={() =>
                  onSelectedTagsChange(selectedTags.filter((t) => t !== tag))
                }
                className="hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            onClick={() => onSelectedTagsChange([])}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
