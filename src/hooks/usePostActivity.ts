'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * usePostActivity — Phase 4b of the Mixpost UI port.
 *
 * Fetches the activity timeline for a scheduled post and subscribes to
 * Supabase Realtime for new rows, so comments appear live for every
 * viewer without polling. Returns an optimistic addComment() that
 * posts to /api/post-activity and lets the realtime channel backfill
 * the authoritative row.
 *
 * Rows are ordered newest-first on fetch but the caller typically
 * reverses for display (oldest at top, newest at bottom with the
 * composer pinned under it).
 */

export interface PostActivityUser {
  id: string
  email: string | null
  raw_user_meta_data: Record<string, unknown> | null
}

export interface PostActivityRow {
  id: string
  scheduled_post_id: string
  user_id: string | null
  type:
    | 'comment'
    | 'created'
    | 'scheduled'
    | 'rescheduled'
    | 'published'
    | 'failed'
    | 'status_change'
    | 'edit'
  body: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  users?: PostActivityUser | null
}

export interface UsePostActivityResult {
  activity: PostActivityRow[]
  loading: boolean
  error: string | null
  addComment: (body: string) => Promise<void>
  refresh: () => Promise<void>
}

export function usePostActivity({
  scheduledPostId,
}: {
  scheduledPostId: string | null
}): UsePostActivityResult {
  const [activity, setActivity] = useState<PostActivityRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  if (!supabaseRef.current) {
    supabaseRef.current = createClient()
  }

  const fetchActivity = useCallback(async () => {
    if (!scheduledPostId) {
      setActivity([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/post-activity?scheduled_post_id=${encodeURIComponent(scheduledPostId)}`,
      )
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error ?? `Failed to load activity (${res.status})`)
      }
      const rows = (await res.json()) as PostActivityRow[]
      setActivity(Array.isArray(rows) ? rows : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
      setActivity([])
    } finally {
      setLoading(false)
    }
  }, [scheduledPostId])

  // Initial fetch whenever the scheduled post changes.
  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  // Realtime subscription — one channel per scheduled_post_id so we
  // only receive inserts for the active draft. The channel is cleaned
  // up on unmount / post switch to avoid leaks.
  useEffect(() => {
    if (!scheduledPostId) return
    const supabase = supabaseRef.current
    if (!supabase) return

    const channel = supabase
      .channel(`post_activity:${scheduledPostId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_activity',
          filter: `scheduled_post_id=eq.${scheduledPostId}`,
        },
        (payload) => {
          const row = payload.new as PostActivityRow
          setActivity((prev) => {
            // Deduplicate — the optimistic POST may have already
            // inserted the row by id. Realtime shouldn't fire twice
            // for the same id, but be defensive.
            if (prev.some((r) => r.id === row.id)) return prev
            // Newest first (same order as the fetch).
            return [row, ...prev]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [scheduledPostId])

  const addComment = useCallback(
    async (body: string) => {
      if (!scheduledPostId) return
      const trimmed = body.trim()
      if (!trimmed) return
      const res = await fetch('/api/post-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_post_id: scheduledPostId,
          type: 'comment',
          body: trimmed,
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Failed to post comment')
      }
      const row = (await res.json()) as PostActivityRow
      // Optimistic local insert — realtime will dedupe on id if it
      // arrives after this.
      setActivity((prev) => {
        if (prev.some((r) => r.id === row.id)) return prev
        return [row, ...prev]
      })
    },
    [scheduledPostId],
  )

  return { activity, loading, error, addComment, refresh: fetchActivity }
}
