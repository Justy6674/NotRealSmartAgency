'use client'

export const dynamic = 'force-dynamic'

import { useSearchParams } from 'next/navigation'
import { PostCreator } from '@/components/agency/studio/post/PostCreator'
import { useAgencyStore } from '@/stores/agency-store'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function CreatePage() {
  const { pendingDraftId, pendingMediaId, setPendingDraftId, setPendingMediaId } = useAgencyStore()
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft')
  const mediaParam = searchParams.get('media')
  const conversationParam = searchParams.get('conversation')
  const outputParam = searchParams.get('output')
  const exactDraftId = draftParam && UUID_PATTERN.test(draftParam) ? draftParam : null
  const exactMediaId = mediaParam && UUID_PATTERN.test(mediaParam) ? mediaParam : null
  const deskConversationId = conversationParam && UUID_PATTERN.test(conversationParam) ? conversationParam : undefined
  const deskOutputId = outputParam && UUID_PATTERN.test(outputParam) ? outputParam : undefined

  const handleDone = () => {
    setPendingDraftId(null)
    setPendingMediaId(null)
  }

  // Calendar week view passes date + time as query params when clicking an empty slot
  const dateParam = searchParams.get('date')
  const timeParam = searchParams.get('time')
  let initialScheduleDate: string | undefined
  if (dateParam) {
    // Build ISO datetime from date (YYYY-MM-DD) + optional time (HH:mm)
    const timePart = timeParam ?? '09:00'
    initialScheduleDate = `${dateParam}T${timePart}`
  }

  return (
    <div className="h-full overflow-hidden">
      <PostCreator
        draftId={exactDraftId ?? pendingDraftId ?? undefined}
        mediaId={exactMediaId ?? pendingMediaId ?? undefined}
        deskConversationId={deskConversationId}
        deskOutputId={deskOutputId}
        onDone={handleDone}
        initialScheduleDate={initialScheduleDate}
      />
    </div>
  )
}
