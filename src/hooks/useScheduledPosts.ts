import { useCallback, useEffect, useState } from 'react'
import type { ScheduledPost } from '@/types/database'

interface UseScheduledPostsArgs {
  brandId: string | null
  /** ISO date string — filter posts scheduled on or after this date */
  from?: string
  /** ISO date string — filter posts scheduled on or before this date */
  to?: string
  /** Filter by status */
  status?: ScheduledPost['status']
}

interface UseScheduledPostsResult {
  posts: ScheduledPost[]
  loading: boolean
  error: string | null
  /** Refetch from the server, bypassing local optimistic state */
  refetch: () => Promise<void>
  /**
   * Reschedule a post optimistically and persist to the server.
   * On failure, rolls back by refetching from the server.
   * Throws on failure so the caller can react (e.g., FullCalendar.revert()).
   */
  reschedulePost: (id: string, scheduledAt: string) => Promise<void>
}

/**
 * Shared fetch + optimistic-mutate hook for scheduled_posts.
 *
 * Phase 1 of the Mixpost UI port — used by EnhancedCalendar to replace
 * its inline fetch logic. Subsequent phases (Posts Index, Review,
 * Dashboard, Analytics) will reuse this same hook so every surface
 * reading scheduled_posts shares cache-busting and optimistic update
 * semantics.
 *
 * The server route is /api/scheduled-posts which accepts brandId, from,
 * to, and status query params (see src/app/api/scheduled-posts/route.ts).
 */
export function useScheduledPosts(args: UseScheduledPostsArgs): UseScheduledPostsResult {
  const { brandId, from, to, status } = args
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!brandId) {
      setPosts([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ brandId })
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      if (status) qs.set('status', status)
      const res = await fetch(`/api/scheduled-posts?${qs.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'fetch failed')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [brandId, from, to, status])

  useEffect(() => { refetch() }, [refetch])

  const reschedulePost = useCallback(
    async (id: string, scheduledAt: string) => {
      const previous = posts.find((p) => p.id === id)
      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, scheduled_at: scheduledAt } : p)),
      )
      try {
        const res = await fetch('/api/scheduled-posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, scheduled_at: scheduledAt }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
      } catch (err) {
        // Rollback the specific row using the captured previous value,
        // avoiding a full refetch to preserve any concurrent updates
        if (previous) {
          setPosts((prev) =>
            prev.map((p) => (p.id === id ? previous : p)),
          )
        } else {
          await refetch()
        }
        throw err
      }
    },
    [posts, refetch],
  )

  return { posts, loading, error, refetch, reschedulePost }
}
