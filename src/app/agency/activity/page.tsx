'use client'

export const dynamic = 'force-dynamic'

import { ActivityFeed } from '@/components/agency/ActivityFeed'

export default function ActivityPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold text-foreground mb-4">Activity Feed</h1>
      <ActivityFeed />
    </div>
  )
}
