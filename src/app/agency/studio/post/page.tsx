'use client'
export const dynamic = 'force-dynamic'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { PostComposerRoom } from '@/components/agency/studio/post/PostComposerRoom'

export default function PostComposerPage() {
  return (
    <RoomLayout title="Post Composer">
      <PostComposerRoom />
    </RoomLayout>
  )
}
