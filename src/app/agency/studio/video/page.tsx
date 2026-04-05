'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'

export default function VideoRoomPage() {
  return (
    <RoomLayout title="Video Room">
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
        Video Room — coming soon
      </div>
    </RoomLayout>
  )
}
