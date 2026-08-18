'use client'

import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { usePostActivity } from '@/hooks/usePostActivity'
import { ActivityCommentRow, ActivityEventRow } from './ActivityEventRow'
import { ActivityCommentBox } from './ActivityCommentBox'

/**
 * The Activity half of the composer's right pane.
 *
 * Two things in one column, in one order: everything that has happened to this
 * post, oldest first, and a box to add to it. That is how Mixpost's PostActivity
 * reads and it is the right shape — the history is the context for the note
 * somebody is about to leave, so it has to be above it, not behind a tab.
 *
 * Before the post is saved there is nothing to attach a note to. The pane says
 * so plainly instead of showing an empty thread that silently swallows a
 * comment.
 */
export function ComposerActivityPane({ scheduledPostId }: { scheduledPostId: string | null }) {
  const { activity, loading, error, addComment } = usePostActivity({ scheduledPostId })

  // The hook returns newest-first to match the API. A history reads forwards.
  const inOrder = useMemo(() => [...activity].reverse(), [activity])

  if (!scheduledPostId) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-[26px] py-[40px]">
        <div className="max-w-[320px] text-center">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
            Nothing to show yet
          </p>
          <p
            className="mt-[6px] text-[12.5px] leading-[1.5]"
            style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
          >
            Save this post and its history starts here — every change, every time it goes out, and
            anything you or your team want to say about it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-[15px] py-[12px]">
        {loading && inOrder.length === 0 ? (
          <div className="flex items-center justify-center py-[32px]">
            <Loader2
              className="h-[16px] w-[16px] animate-spin"
              style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
              aria-label="Loading history"
            />
          </div>
        ) : error ? (
          <p
            className="rounded-[8px] border px-[11px] py-[8px] text-[12px]"
            style={{
              borderColor: 'var(--st-fail, oklch(0.58 0.17 27))',
              background: 'oklch(0.97 0.02 27)',
              color: 'oklch(0.45 0.14 27)',
            }}
          >
            The history for this post could not be loaded just now.
          </p>
        ) : inOrder.length === 0 ? (
          <p className="py-[24px] text-center text-[12.5px]" style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}>
            Nothing has happened to this post yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {inOrder.map((row) =>
              row.type === 'comment' ? (
                <ActivityCommentRow key={row.id} row={row} />
              ) : (
                <ActivityEventRow key={row.id} row={row} />
              ),
            )}
          </div>
        )}
      </div>

      <ActivityCommentBox onSubmit={addComment} />
    </div>
  )
}
