'use client'
export const dynamic = 'force-dynamic'

import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { HashtagManagerPage } from '@/components/agency/studio/hashtags/HashtagManagerPage'
import { useAgencyStore } from '@/stores/agency-store'

export default function HashtagsPage() {
  const { activeBrandId } = useAgencyStore()

  return (
    <RoomLayout title="Hashtag groups">
      <HashtagManagerPage brandId={activeBrandId} />
    </RoomLayout>
  )
}
