import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ScheduledPost, PostPlatform, ScheduledPostStatus } from '@/types/database'

/**
 * Sort key supported by the Posts Index page. Maps to a column on
 * scheduled_posts plus an explicit direction. We sort client-side because
 * /api/scheduled-posts only sorts by scheduled_at ascending.
 */
export type PostsSortKey = 'created_at' | 'scheduled_at' | 'published_at'
export type PostsSortDir = 'asc' | 'desc'

export interface PostsListFilters {
  /** Free-text search across caption + hashtags. Server route doesn't
   *  support this so we apply it client-side after fetch. */
  search?: string
  statuses?: ScheduledPostStatus[]
  platforms?: PostPlatform[]
  /** ISO date strings — inclusive lower / upper bound on scheduled_at. */
  from?: string
  to?: string
  sortKey?: PostsSortKey
  sortDir?: PostsSortDir
}

interface UsePostsListArgs extends PostsListFilters {
  brandId: string | null
  page?: number
  pageSize?: number
}

interface UsePostsListResult {
  /** The current visible page after filter + sort + pagination. */
  posts: ScheduledPost[]
  /** Total matching post count after filtering, before pagination. */
  total: number
  loading: boolean
  error: string | null
  page: number
  pageSize: number
  totalPages: number
  filters: PostsListFilters
  setFilters: (next: PostsListFilters) => void
  setPage: (page: number) => void
  refetch: () => Promise<void>
}

/**
 * Posts Index data hook — fetches every scheduled_post row for a brand
 * (optionally bounded by date range), then applies search / status /
 * platform / sort / pagination on the client.
 *
 * Why client-side: the existing /api/scheduled-posts GET only supports
 * `brandId`, `from`, `to` and a single `status`. Extending it to support
 * multi-status, search, multi-platform and pagination would touch shared
 * code that other Phase 4 streams already build against. Client-side
 * filtering is fine for this surface — even very active brands rarely
 * exceed a few hundred scheduled posts at a time.
 */
export function usePostsList(args: UsePostsListArgs): UsePostsListResult {
  const {
    brandId,
    page: initialPage = 1,
    pageSize: initialPageSize = 20,
    ...initialFilters
  } = args

  const [allPosts, setAllPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<PostsListFilters>(initialFilters)
  const [page, setPageState] = useState(initialPage)

  // Stash the latest filters in a ref so the fetcher only re-runs when the
  // filters that actually hit the server change (brandId / from / to).
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const refetch = useCallback(async () => {
    if (!brandId) {
      setAllPosts([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ brandId })
      if (filtersRef.current.from) qs.set('from', filtersRef.current.from)
      if (filtersRef.current.to) qs.set('to', filtersRef.current.to)
      const res = await fetch(`/api/scheduled-posts?${qs.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setAllPosts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'fetch failed')
      setAllPosts([])
    } finally {
      setLoading(false)
    }
  }, [brandId])

  // Re-fetch only when brandId or the *server-affecting* filters change.
  useEffect(() => {
    void refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, filters.from, filters.to])

  const filtered = useMemo(() => {
    let rows = allPosts

    if (filters.statuses && filters.statuses.length > 0) {
      const set = new Set(filters.statuses)
      rows = rows.filter((p) => set.has(p.status))
    }

    if (filters.platforms && filters.platforms.length > 0) {
      const set = new Set(filters.platforms)
      rows = rows.filter((p) => set.has(p.platform))
    }

    if (filters.search && filters.search.trim().length > 0) {
      const needle = filters.search.trim().toLowerCase()
      rows = rows.filter((p) => {
        if (p.caption?.toLowerCase().includes(needle)) return true
        if (p.hashtags?.some((h) => h.toLowerCase().includes(needle))) return true
        return false
      })
    }

    const sortKey: PostsSortKey = filters.sortKey ?? 'scheduled_at'
    const sortDir: PostsSortDir = filters.sortDir ?? 'desc'
    const sorted = [...rows].sort((a, b) => {
      const av = (a[sortKey] as string | null) ?? ''
      const bv = (b[sortKey] as string | null) ?? ''
      // Empty values sort last regardless of direction
      if (!av && !bv) return 0
      if (!av) return 1
      if (!bv) return -1
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return sorted
  }, [allPosts, filters])

  const total = filtered.length
  const pageSize = initialPageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Clamp page when filtering shrinks the result set
  useEffect(() => {
    if (page > totalPages) setPageState(totalPages)
  }, [page, totalPages])

  const visible = useMemo(() => {
    const start = (page - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, page, pageSize])

  const setFilters = useCallback((next: PostsListFilters) => {
    setFiltersState(next)
    setPageState(1)
  }, [])

  const setPage = useCallback((next: number) => {
    setPageState(Math.max(1, next))
  }, [])

  return {
    posts: visible,
    total,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    filters,
    setFilters,
    setPage,
    refetch,
  }
}
