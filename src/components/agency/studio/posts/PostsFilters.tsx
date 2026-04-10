'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, X, Calendar as CalendarIcon } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PostPlatform, ScheduledPostStatus } from '@/types/database'
import type { PostsListFilters, PostsSortKey, PostsSortDir } from '@/hooks/usePostsList'

/**
 * Six-platform subset matching the PostPlatform union in src/types/database.ts.
 * The shared ui-tokens.ts ships labels for ten platforms (Bluesky, Mastodon
 * etc) but those aren't valid scheduled_post.platform values yet.
 */
const PLATFORM_OPTIONS: { value: PostPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'X' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
]

const STATUS_OPTIONS: { value: ScheduledPostStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const SORT_OPTIONS: { value: PostsSortKey; label: string }[] = [
  { value: 'scheduled_at', label: 'Scheduled date' },
  { value: 'created_at', label: 'Created date' },
  { value: 'published_at', label: 'Published date' },
]

interface PostsFiltersProps {
  filters: PostsListFilters
  onChange: (filters: PostsListFilters) => void
  total: number
}

export function PostsFilters({ filters, onChange, total }: PostsFiltersProps) {
  // Local search state with 300ms debounce so the parent doesn't re-render
  // (and the filtered list doesn't recompute) on every keystroke.
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if ((filters.search ?? '') !== searchInput) {
        onChange({ ...filters, search: searchInput })
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  // Sync local state if the parent resets filters externally
  useEffect(() => {
    if ((filters.search ?? '') !== searchInput) {
      setSearchInput(filters.search ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search])

  const toggleStatus = (status: ScheduledPostStatus) => {
    const current = filters.statuses ?? []
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    onChange({ ...filters, statuses: next })
  }

  const togglePlatform = (platform: PostPlatform) => {
    const current = filters.platforms ?? []
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform]
    onChange({ ...filters, platforms: next })
  }

  const setSortKey = (key: PostsSortKey) => onChange({ ...filters, sortKey: key })
  const setSortDir = (dir: PostsSortDir) => onChange({ ...filters, sortDir: dir })

  const setFromDate = (value: string) => onChange({ ...filters, from: value || undefined })
  const setToDate = (value: string) => onChange({ ...filters, to: value || undefined })

  const hasActiveFilters =
    !!filters.search ||
    (filters.statuses?.length ?? 0) > 0 ||
    (filters.platforms?.length ?? 0) > 0 ||
    !!filters.from ||
    !!filters.to

  const clearAll = () => {
    setSearchInput('')
    onChange({ sortKey: filters.sortKey, sortDir: filters.sortDir })
  }

  const statusLabel =
    filters.statuses && filters.statuses.length > 0
      ? `${filters.statuses.length} status${filters.statuses.length === 1 ? '' : 'es'}`
      : 'Status'
  const platformLabel =
    filters.platforms && filters.platforms.length > 0
      ? `${filters.platforms.length} platform${filters.platforms.length === 1 ? '' : 's'}`
      : 'Platform'
  const sortLabel = SORT_OPTIONS.find((o) => o.value === (filters.sortKey ?? 'scheduled_at'))?.label
  const sortDir: PostsSortDir = filters.sortDir ?? 'desc'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search caption or hashtags…"
            className="pl-8"
          />
        </div>

        {/* Status multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="sm">
                {statusLabel}
                <ChevronDown className="ml-1" />
              </Button>
            )}
          />
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Filter status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTIONS.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={(filters.statuses ?? []).includes(opt.value)}
                closeOnClick={false}
                onClick={(e) => {
                  e.preventDefault()
                  toggleStatus(opt.value)
                }}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Platform multi-select */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="sm">
                {platformLabel}
                <ChevronDown className="ml-1" />
              </Button>
            )}
          />
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Filter platform</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {PLATFORM_OPTIONS.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={(filters.platforms ?? []).includes(opt.value)}
                closeOnClick={false}
                onClick={(e) => {
                  e.preventDefault()
                  togglePlatform(opt.value)
                }}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date range */}
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
          <CalendarIcon className="h-3.5 w-3.5" />
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-transparent text-foreground outline-none"
            aria-label="From date"
          />
          <span>–</span>
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-transparent text-foreground outline-none"
            aria-label="To date"
          />
        </div>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="sm">
                Sort: {sortLabel} ({sortDir})
                <ChevronDown className="ml-1" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={filters.sortKey ?? 'scheduled_at'}
              onValueChange={(value) => setSortKey(value as PostsSortKey)}
            >
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Direction</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sortDir}
              onValueChange={(value) => setSortDir(value as PostsSortDir)}
            >
              <DropdownMenuRadioItem value="desc">Newest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="asc">Oldest first</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X className="mr-1" />
            Clear
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {total} {total === 1 ? 'post' : 'posts'}
        </div>
      </div>
    </div>
  )
}
