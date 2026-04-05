'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'

export default function DesignRoomPage() {
  return (
    <RoomLayout title="Design Room">
      <div className="flex items-center justify-center p-12 text-muted-foreground text-sm">
        Design Room — coming soon
      </div>
    </RoomLayout>
  )
}
