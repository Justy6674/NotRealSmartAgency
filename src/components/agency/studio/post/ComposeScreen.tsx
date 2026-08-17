'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { PostCreator } from '@/components/agency/studio/post/PostCreator'
import { useAgencyStore } from '@/stores/agency-store'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * The composer, reached from Create post, an empty calendar slot, Review, or
 * a restored Desk proposal. One screen so those entry points cannot drift.
 */
export function ComposeScreen() {
  return (
    <Suspense fallback={<div className="h-full min-h-0" />}>
      <ComposeScreenInner />
    </Suspense>
  )
}

function ComposeScreenInner() {
  const { pendingDraftId, pendingMediaId, setPendingDraftId, setPendingMediaId } = useAgencyStore()
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft')
  const mediaParam = searchParams.get('media')
  const conversationParam = searchParams.get('conversation')
  const outputParam = searchParams.get('output')
  const exactDraftId = draftParam && UUID_PATTERN.test(draftParam) ? draftParam : null
  const exactMediaId = mediaParam && UUID_PATTERN.test(mediaParam) ? mediaParam : null
  const deskConversationId =
    conversationParam && UUID_PATTERN.test(conversationParam) ? conversationParam : undefined
  const deskOutputId = outputParam && UUID_PATTERN.test(outputParam) ? outputParam : undefined

  const dateParam = searchParams.get('date')
  const timeParam = searchParams.get('time')
  const initialScheduleDate = dateParam ? `${dateParam}T${timeParam ?? '09:00'}` : undefined

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <PostCreator
        draftId={exactDraftId ?? pendingDraftId ?? undefined}
        mediaId={exactMediaId ?? pendingMediaId ?? undefined}
        deskConversationId={deskConversationId}
        deskOutputId={deskOutputId}
        onDone={() => {
          setPendingDraftId(null)
          setPendingMediaId(null)
        }}
        initialScheduleDate={initialScheduleDate}
      />
    </div>
  )
}
