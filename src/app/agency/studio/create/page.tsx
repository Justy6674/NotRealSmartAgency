'use client'

export const dynamic = 'force-dynamic'

import { PostCreator } from '@/components/agency/studio/post/PostCreator'
import { useAgencyStore } from '@/stores/agency-store'

export default function CreatePage() {
  const { pendingDraftId, pendingMediaId, setPendingDraftId, setPendingMediaId } = useAgencyStore()

  const handleDone = () => {
    setPendingDraftId(null)
    setPendingMediaId(null)
  }

  return (
    <div className="h-full overflow-hidden">
      <PostCreator
        draftId={pendingDraftId ?? undefined}
        mediaId={pendingMediaId ?? undefined}
        onDone={handleDone}
      />
    </div>
  )
}
