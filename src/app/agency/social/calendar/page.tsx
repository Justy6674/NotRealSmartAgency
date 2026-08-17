'use client'

export const dynamic = 'force-dynamic'

import { EnhancedCalendar } from '@/components/agency/studio/EnhancedCalendar'
import { CalendarActions } from '@/components/agency/studio/CalendarActions'

export default function SocialCalendarPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
      <CalendarActions />
      <EnhancedCalendar />
    </div>
  )
}
