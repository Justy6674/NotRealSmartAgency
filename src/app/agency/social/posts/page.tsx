'use client'

export const dynamic = 'force-dynamic'

import { useSearchParams } from 'next/navigation'
import { PostsIndex } from '@/components/agency/studio/posts/PostsIndex'
import { ReviewRoom } from '@/components/agency/studio/ReviewRoom'
import { WAITING_ON_YOU_FILTER } from '@/components/agency/shell/nav-sections'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Posts, or the approval queue when `?status=waiting`.
 *
 * Waiting on you is not a thirteenth department and it is not a status on
 * `scheduled_posts` — there is no `waiting` enum. It is Review, reached as a
 * filter on this list so the sidebar and the screen cannot disagree.
 */
export default function SocialPostsPage() {
  const searchParams = useSearchParams()
  const waiting = searchParams.get(WAITING_ON_YOU_FILTER.param) === WAITING_ON_YOU_FILTER.value

  if (waiting) {
    const draftParam = searchParams.get('draft')
    const initialDraftId = draftParam && UUID_PATTERN.test(draftParam) ? draftParam : undefined
    return <ReviewRoom initialDraftId={initialDraftId} />
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <PostsIndex />
      </div>
    </div>
  )
}
