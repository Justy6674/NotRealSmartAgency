import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PostLabel } from '@/lib/posts/post-labels'
import type { PublisherRunReceipt } from '@/lib/publishers/receipts'

/**
 * The Posts list — one feed, two origins.
 *
 * A post on this desk is one of two things and the list has to show both:
 *
 *   `desk`    — a row this app made. Editable, labellable, schedulable, and the
 *               only kind that can sit in Drafts, Waiting on you or Trash.
 *   `history` — something published on an account before it was connected here,
 *               or from a phone. Read-only, and by far the larger half: a live
 *               brand carries 210 of these against a handful of desk rows.
 *
 * They arrive merged from `/api/scheduled-posts?history=1`, which also decides
 * the status word (the derivation lives there so the tab counts, the sidebar
 * badge and the row dot cannot disagree). Filtering, sorting and paging stay on
 * the client: the whole feed is a few hundred rows, and paging two collections
 * with two different pagination models server-side produces a list where "page
 * 3" means nothing.
 */

export type PostOrigin = 'desk' | 'history'

/**
 * Eight states. Six are `scheduled_posts.status`; `partial` is the publisher's
 * own — some accounts on a multi-account post took it and some did not, which
 * our enum has no word for and used to render as nothing at all; and
 * `needs_approval` is a draft an assistant wrote that the owner has not yet
 * said yes to.
 */
export type DeskPostStatus =
  | 'draft'
  | 'needs_approval'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partial'
  | 'failed'
  | 'cancelled'

export interface SocialPostAccount {
  id: string
  platform: string
  name: string
}

export interface SocialPostRow {
  id: string
  origin: PostOrigin
  brand_id: string | null
  /** First platform, kept for the many places that still assume one. */
  platform: string
  /** Every platform this post went to. A history row can carry several. */
  platforms: string[]
  caption: string
  hashtags: string[]
  scheduled_at: string | null
  published_at: string | null
  status: DeskPostStatus
  media_item_ids: string[]
  media_count: number
  /** Set on history rows, which have no media_items row to look up. */
  thumbnail_url: string | null
  external_post_id: string | null
  permalinks: string[]
  labels: PostLabel[]
  accounts: SocialPostAccount[]
  post_type: string | null
  error: string | null
  metadata: Record<string, unknown>
  receipts: PublisherRunReceipt[]
}

export interface HistoryMeta {
  total: number
  shown: number
  truncated: boolean
  unavailable: string | null
}

export type PostsSortKey = 'created_at' | 'scheduled_at' | 'published_at'
export type PostsSortDir = 'asc' | 'desc'

export interface PostsListFilters {
  search?: string
  statuses?: DeskPostStatus[]
  platforms?: string[]
  labelIds?: string[]
  accountIds?: string[]
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

export type StatusCounts = Record<DeskPostStatus, number>

interface UsePostsListResult {
  posts: SocialPostRow[]
  /** Matching rows after filtering, before paging. */
  total: number
  /** Every row before any filter — the "All" count. */
  allCount: number
  statusCounts: StatusCounts
  /** Labels defined for this business, for the picker and the filter. */
  labels: PostLabel[]
  /** Every account seen on the feed, for the account filter. */
  accounts: SocialPostAccount[]
  history: HistoryMeta | null
  loading: boolean
  error: string | null
  page: number
  pageSize: number
  totalPages: number
  filters: PostsListFilters
  setFilters: (next: PostsListFilters) => void
  setPage: (page: number) => void
  refetch: () => Promise<void>
  refetchLabels: () => Promise<void>
}

const EMPTY_COUNTS: StatusCounts = {
  draft: 0,
  needs_approval: 0,
  scheduled: 0,
  publishing: 0,
  published: 0,
  partial: 0,
  failed: 0,
  cancelled: 0,
}

function sortValue(row: SocialPostRow, key: PostsSortKey): string {
  if (key === 'published_at') return row.published_at ?? ''
  if (key === 'scheduled_at') return row.scheduled_at ?? row.published_at ?? ''
  // History rows have no created_at of their own; the moment they went out is
  // the closest true thing, and inventing one would sort them into the future.
  return (row.metadata.createdAt as string | undefined) ?? row.published_at ?? row.scheduled_at ?? ''
}

export function usePostsList(args: UsePostsListArgs): UsePostsListResult {
  const {
    brandId,
    page: initialPage = 1,
    pageSize: initialPageSize = 20,
    ...initialFilters
  } = args

  const [allPosts, setAllPosts] = useState<SocialPostRow[]>([])
  const [labels, setLabels] = useState<PostLabel[]>([])
  const [history, setHistory] = useState<HistoryMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<PostsListFilters>(initialFilters)
  const [page, setPageState] = useState(initialPage)

  // The latest filters, stashed so the fetcher only re-runs when a filter that
  // actually reaches the server changes (brandId / from / to).
  const filtersRef = useRef(filters)
  filtersRef.current = filters

  const refetchLabels = useCallback(async () => {
    if (!brandId) {
      setLabels([])
      return
    }
    try {
      const res = await fetch(`/api/scheduled-posts?brandId=${brandId}&labels=1`)
      if (!res.ok) return
      const data = await res.json()
      setLabels(Array.isArray(data) ? data : [])
    } catch {
      // A missing label list makes the picker empty, not the page broken.
    }
  }, [brandId])

  const refetch = useCallback(async () => {
    if (!brandId) {
      setAllPosts([])
      setHistory(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ brandId, history: '1' })
      if (filtersRef.current.from) qs.set('from', filtersRef.current.from)
      if (filtersRef.current.to) qs.set('to', filtersRef.current.to)
      const res = await fetch(`/api/scheduled-posts?${qs.toString()}`)
      if (!res.ok) throw new Error('Your posts could not be loaded just now.')
      const data = (await res.json()) as { posts?: SocialPostRow[]; history?: HistoryMeta }
      setAllPosts(Array.isArray(data.posts) ? data.posts : [])
      setHistory(data.history ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your posts could not be loaded just now.')
      setAllPosts([])
      setHistory(null)
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    void refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, filters.from, filters.to])

  useEffect(() => {
    void refetchLabels()
  }, [refetchLabels])

  const filtered = useMemo(() => {
    let rows = allPosts

    if (filters.statuses && filters.statuses.length > 0) {
      const set = new Set(filters.statuses)
      rows = rows.filter((p) => set.has(p.status))
    } else {
      // "All" is everything except the bin, the way Mixpost has it. A deleted
      // post reappearing in the default view is the reason people stop trusting
      // a delete button.
      rows = rows.filter((p) => p.status !== 'cancelled')
    }

    if (filters.platforms && filters.platforms.length > 0) {
      const set = new Set(filters.platforms)
      rows = rows.filter((p) => p.platforms.some((platform) => set.has(platform)))
    }

    if (filters.labelIds && filters.labelIds.length > 0) {
      const set = new Set(filters.labelIds)
      rows = rows.filter((p) => p.labels.some((label) => set.has(label.id)))
    }

    if (filters.accountIds && filters.accountIds.length > 0) {
      const set = new Set(filters.accountIds)
      rows = rows.filter((p) => p.accounts.some((account) => set.has(account.id)))
    }

    if (filters.search && filters.search.trim().length > 0) {
      const needle = filters.search.trim().toLowerCase()
      rows = rows.filter((p) => {
        if (p.caption.toLowerCase().includes(needle)) return true
        if (p.hashtags.some((h) => h.toLowerCase().includes(needle))) return true
        if (p.labels.some((l) => l.name.toLowerCase().includes(needle))) return true
        return false
      })
    }

    const sortKey: PostsSortKey = filters.sortKey ?? 'scheduled_at'
    const sortDir: PostsSortDir = filters.sortDir ?? 'desc'
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sortKey)
      const bv = sortValue(b, sortKey)
      if (!av && !bv) return 0
      if (!av) return 1
      if (!bv) return -1
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [allPosts, filters])

  const statusCounts = useMemo<StatusCounts>(() => {
    const counts: StatusCounts = { ...EMPTY_COUNTS }
    for (const p of allPosts) {
      if (p.status in counts) counts[p.status]++
    }
    return counts
  }, [allPosts])

  const accounts = useMemo<SocialPostAccount[]>(() => {
    const byId = new Map<string, SocialPostAccount>()
    for (const post of allPosts) {
      for (const account of post.accounts) {
        if (account.id && !byId.has(account.id)) byId.set(account.id, account)
      }
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allPosts])

  // The number beside "All", which must agree with what All actually shows.
  const allCount = allPosts.filter((post) => post.status !== 'cancelled').length
  const total = filtered.length
  const pageSize = initialPageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

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
    allCount,
    statusCounts,
    labels,
    accounts,
    history,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    filters,
    setFilters,
    setPage,
    refetch,
    refetchLabels,
  }
}
