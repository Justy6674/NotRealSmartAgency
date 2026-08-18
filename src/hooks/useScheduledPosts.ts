import { useCallback, useEffect, useState } from 'react'
import type { SocialPostRow } from '@/hooks/usePostsList'

interface UseScheduledPostsArgs {
  brandId: string | null
  /** ISO date string — only posts on or after this date. */
  from?: string
  /** ISO date string — only posts on or before this date. */
  to?: string
}

interface UseScheduledPostsResult {
  posts: SocialPostRow[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  /**
   * Move a post to a new time, optimistically, and put it back exactly where it
   * was if the server refuses. Throws so the caller can revert its own view —
   * FullCalendar needs `info.revert()` called from inside the failure.
   */
  reschedulePost: (id: string, scheduledAt: string) => Promise<void>
}

/**
 * The calendar's feed.
 *
 * It reads the same merged list the Posts page does — desk rows and published
 * history together — for one reason: a month view that shows only what this app
 * made is a month view with holes in it, and the owner cannot tell a quiet week
 * from a week whose posts went out from a phone.
 *
 * Rescheduling goes through `/api/social/posts/[postId]`, which moves the time
 * on the publisher as well as here. Moving ours alone is how a post goes out at
 * the old time while the calendar shows the new one.
 */
export function useScheduledPosts(args: UseScheduledPostsArgs): UseScheduledPostsResult {
  const { brandId, from, to } = args
  const [posts, setPosts] = useState<SocialPostRow[]>([])
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
      const qs = new URLSearchParams({ brandId, history: '1' })
      if (from) qs.set('from', from)
      if (to) qs.set('to', to)
      const res = await fetch(`/api/scheduled-posts?${qs.toString()}`)
      if (!res.ok) throw new Error('Your calendar could not be loaded just now.')
      const data = (await res.json()) as { posts?: SocialPostRow[] }
      setPosts(Array.isArray(data.posts) ? data.posts : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your calendar could not be loaded just now.')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [brandId, from, to])

  useEffect(() => {
    void refetch()
  }, [refetch])

  const reschedulePost = useCallback(
    async (id: string, scheduledAt: string) => {
      let previous: SocialPostRow | undefined
      setPosts((prev) => {
        previous = prev.find((p) => p.id === id)
        return prev.map((p) => (p.id === id ? { ...p, scheduled_at: scheduledAt } : p))
      })
      try {
        const res = await fetch(`/api/social/posts/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reschedule', scheduledFor: scheduledAt, brandId }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'That time could not be saved.')
        }
      } catch (err) {
        // Roll back the one row from the captured value rather than refetching,
        // so a concurrent change to another row is not thrown away with it.
        if (previous) {
          const restore = previous
          setPosts((prev) => prev.map((p) => (p.id === id ? restore : p)))
        } else {
          await refetch()
        }
        throw err
      }
    },
    [brandId, refetch],
  )

  return { posts, loading, error, refetch, reschedulePost }
}
