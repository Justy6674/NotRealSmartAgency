'use client'

import { useMemo } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import { usePostActivity } from '@/hooks/usePostActivity'
import { PostActivityItem } from './PostActivityItem'
import { CommentEditor } from './CommentEditor'

/**
 * PostActivityThread — Phase 4b of the Mixpost UI port.
 *
 * Main container for the draft-post comment thread. Scrollable list
 * of comments + system events (oldest-first for readability) with a
 * pinned CommentEditor at the bottom. Subscribes to Supabase Realtime
 * via usePostActivity so new comments appear live for every viewer.
 *
 * Layout is column-flex with min-h-0 so the scrollable list can
 * actually scroll inside a fixed-height parent (e.g. the Review
 * Room's detail tab). The composer stays visible at the bottom.
 */

interface PostActivityThreadProps {
  scheduledPostId: string
  className?: string
}

export function PostActivityThread({
  scheduledPostId,
  className = '',
}: PostActivityThreadProps) {
  const { activity, loading, error, addComment } = usePostActivity({
    scheduledPostId,
  })

  // Display oldest-first with the newest at the bottom so the
  // conversation reads like a chat thread. usePostActivity returns
  // newest-first to match the API — we reverse for display here.
  const ordered = useMemo(() => [...activity].reverse(), [activity])

  return (
    <div className={`flex h-full min-h-0 flex-col ${className}`}>
      {/* Scrollable list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {loading && activity.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-[oklch(0.65_0.2_25/0.3)] bg-[oklch(0.65_0.2_25/0.05)] px-3 py-2 text-[11px] text-[oklch(0.65_0.2_25)]">
            {error}
          </div>
        ) : ordered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs font-medium text-foreground">
              No activity yet.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Start the conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ordered.map((row) => (
              <PostActivityItem key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>

      {/* Pinned comment editor */}
      <div className="flex-shrink-0">
        <CommentEditor
          onSubmit={addComment}
          placeholder="Add a comment…"
        />
      </div>
    </div>
  )
}
