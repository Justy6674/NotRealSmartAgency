'use client'

export const dynamic = 'force-dynamic'

import { useSearchParams } from 'next/navigation'
import { PostCreator } from '@/components/agency/studio/post/PostCreator'
import { useAgencyStore } from '@/stores/agency-store'

export default function CreatePage() {
  const { pendingDraftId, pendingMediaId, setPendingDraftId, setPendingMediaId } = useAgencyStore()
  const searchParams = useSearchParams()

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
        draftId={pendingDraftId ?? undefined}
        mediaId={pendingMediaId ?? undefined}
        onDone={handleDone}
        initialScheduleDate={initialScheduleDate}
      />
    </div>
  )
}
