'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, X, Calendar as CalendarIcon } from 'lucide-react'
import { PlatformGlyph, isPostablePlatform } from './PlatformGlyph'
import { accountHandle } from './account-identity'
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
import type { PostLabel } from '@/lib/posts/post-labels'
import type {
  PostsListFilters,
  PostsSortKey,
  PostsSortDir,
  SocialPostAccount,
} from '@/hooks/usePostsList'

/**
 * Search, then one dropdown holding labels and accounts, then dates and sort.
 *
 * The same component sits on the Posts list and on the Calendar toolbar,
 * exactly as Mixpost does it — because two filter bars that look alike and
 * behave differently is worse than either one alone. The Calendar hides the
 * sort control (a calendar is sorted by the calendar) via `compact`.
 */

/**
 * X is deliberately absent.
 *
 * The owner does not post to it, and a network offered in a filter is a network
 * the product claims to handle. Anything that publishes, previews or filters
 * asks `isPostablePlatform` rather than carrying its own list, so this cannot
 * drift back in one screen at a time.
 */
const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
].filter((option) => isPostablePlatform(option.value))

const SORT_OPTIONS: { value: PostsSortKey; label: string }[] = [
  { value: 'scheduled_at', label: 'When it goes out' },
  { value: 'created_at', label: 'When it was made' },
  { value: 'published_at', label: 'When it went out' },
]

interface PostsFiltersProps {
  filters: PostsListFilters
  onChange: (filters: PostsListFilters) => void
  /** Rendered on the right — "12 posts", or a calendar's own summary. */
  total?: number
  /** Labels the business has defined. Empty hides the group. */
  labels?: PostLabel[]
  /** Accounts seen on the feed. Empty hides the group. */
  accounts?: SocialPostAccount[]
  /** Calendar mode: no sort control, no count. */
  compact?: boolean
}

export function PostsFilters({
  filters,
  onChange,
  total,
  labels = [],
  accounts = [],
  compact = false,
}: PostsFiltersProps) {
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

  const toggleIn = (key: 'platforms' | 'labelIds' | 'accountIds', value: string) => {
    const current = filters[key] ?? []
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  const setSortKey = (key: PostsSortKey) => onChange({ ...filters, sortKey: key })
  const setSortDir = (dir: PostsSortDir) => onChange({ ...filters, sortDir: dir })
  const setFromDate = (value: string) => onChange({ ...filters, from: value || undefined })
  const setToDate = (value: string) => onChange({ ...filters, to: value || undefined })

  const narrowCount =
    (filters.platforms?.length ?? 0) +
    (filters.labelIds?.length ?? 0) +
    (filters.accountIds?.length ?? 0)

  const hasActiveFilters = !!filters.search || narrowCount > 0 || !!filters.from || !!filters.to

  const clearAll = () => {
    setSearchInput('')
    onChange({ sortKey: filters.sortKey, sortDir: filters.sortDir })
  }

  const sortLabel = SORT_OPTIONS.find((o) => o.value === (filters.sortKey ?? 'scheduled_at'))?.label
  const sortDir: PostsSortDir = filters.sortDir ?? 'desc'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-[200px] max-w-md flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search what you wrote…"
          className="pl-8"
        />
      </div>

      {/* One dropdown for labels, accounts and platforms — Mixpost's `w-72`
          filter panel, with a count chip so a narrowed list never looks empty
          for no visible reason. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <Button {...props} variant="outline" size="sm">
              Narrow
              {narrowCount > 0 && (
                <span
                  className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
                  style={{
                    background: 'var(--brand-wash, oklch(0.966 0.0068 240))',
                    color: 'var(--brand-deep, currentColor)',
                  }}
                >
                  {narrowCount}
                </span>
              )}
              <ChevronDown className="ml-1" />
            </Button>
          )}
        />
        <DropdownMenuContent align="start" className="w-72">
          {labels.length > 0 && (
            <>
              <DropdownMenuLabel>Labels</DropdownMenuLabel>
              {labels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={(filters.labelIds ?? []).includes(label.id)}
                  closeOnClick={false}
                  onClick={(e) => {
                    e.preventDefault()
                    toggleIn('labelIds', label.id)
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-[8px] w-[8px] shrink-0 rounded-full"
                      style={{ backgroundColor: label.colour }}
                    />
                    <span className="truncate">{label.name}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          {accounts.length > 0 && (
            <>
              <DropdownMenuLabel>Accounts</DropdownMenuLabel>
              {accounts.map((account) => (
                <DropdownMenuCheckboxItem
                  key={account.id}
                  checked={(filters.accountIds ?? []).includes(account.id)}
                  closeOnClick={false}
                  onClick={(e) => {
                    e.preventDefault()
                    toggleIn('accountIds', account.id)
                  }}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <PlatformGlyph platform={account.platform} size={12} />
                    <span className="truncate">{account.name}</span>
                    {/* The handle, not just the network. Two of this owner's
                        accounts are both called "Scent Sell" — one a Facebook
                        page, one an Instagram account — so a list showing the
                        name alone asks him to choose between two identical
                        rows. */}
                    <span className="truncate text-muted-foreground">
                      {accountHandle(account)}
                    </span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuLabel>Where it goes</DropdownMenuLabel>
          {PLATFORM_OPTIONS.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={(filters.platforms ?? []).includes(opt.value)}
              closeOnClick={false}
              onClick={(e) => {
                e.preventDefault()
                toggleIn('platforms', opt.value)
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

      {!compact && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="sm">
                Sort: {sortLabel}
                <ChevronDown className="ml-1" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="w-52">
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
            <DropdownMenuRadioGroup
              value={sortDir}
              onValueChange={(value) => setSortDir(value as PostsSortDir)}
            >
              <DropdownMenuRadioItem value="desc">Newest first</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="asc">Oldest first</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="mr-1" />
          Clear
        </Button>
      )}

      {!compact && typeof total === 'number' && (
        <div className="ml-auto text-xs tabular-nums text-muted-foreground">
          {total} {total === 1 ? 'post' : 'posts'}
        </div>
      )}
    </div>
  )
}
