'use client'

export const dynamic = 'force-dynamic'

import { StudioDashboard } from '@/components/agency/studio/StudioDashboard'

/**
 * Dashboard is the first section, at /agency — not a redirect to the old board.
 * Posts and analytics on this screen are NRS `scheduled_posts`, not Mixpost history.
 */
export default function AgencyDashboardPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <StudioDashboard />
    </div>
  )
}
