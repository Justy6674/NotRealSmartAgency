'use client'

export const dynamic = 'force-dynamic'

import { StudioDashboard } from '@/components/agency/studio/StudioDashboard'

/**
 * /agency/studio — the Dashboard home page.
 *
 * The old CreativeStudio component with its internal Create/Review/Schedule/Media
 * tabs has been replaced. Each surface now lives at its own sidebar-linked route:
 * - /agency/studio/create → PostCreator
 * - /agency/studio/calendar → EnhancedCalendar
 * - /agency/studio/media → MediaLibrary
 * - /agency/studio/review → ReviewRoom
 * - /agency/studio/posts → PostsIndex
 * - etc.
 *
 * This page shows the Dashboard — activity summary, widgets, feeds.
 */
export default function StudioPage() {
  return (
    <div className="p-6">
      <StudioDashboard />
    </div>
  )
}
