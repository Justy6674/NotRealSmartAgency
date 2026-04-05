'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { VideoRoom } from '@/components/agency/studio/video/VideoRoom'

export default function VideoRoomPage() {
  return (
    <RoomLayout title="Video Room">
      <VideoRoom />
    </RoomLayout>
  )
}
