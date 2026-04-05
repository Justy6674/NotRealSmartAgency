'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { DesignRoom } from '@/components/agency/studio/design/DesignRoom'

export default function DesignRoomPage() {
  return (
    <RoomLayout title="Design Room">
      <DesignRoom />
    </RoomLayout>
  )
}
