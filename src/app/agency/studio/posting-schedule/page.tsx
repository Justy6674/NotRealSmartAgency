'use client'

export const dynamic = 'force-dynamic'

import { PostingSchedulePage } from '@/components/agency/studio/posting-schedule/PostingSchedulePage'

export default function StudioPostingSchedulePage() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <PostingSchedulePage />
    </div>
  )
}
