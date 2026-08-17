'use client'

export const dynamic = 'force-dynamic'

import { PostingSchedulePage } from '@/components/agency/studio/posting-schedule/PostingSchedulePage'

export default function SocialSchedulePage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <PostingSchedulePage />
      </div>
    </div>
  )
}
