'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { RepurposeRoom } from '@/components/agency/studio/repurpose/RepurposeRoom'

export default function ContentRepurposerPage() {
  return (
    <RoomLayout title="Content Repurposer">
      <RepurposeRoom />
    </RoomLayout>
  )
}
