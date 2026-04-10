'use client'

export const dynamic = 'force-dynamic'

import { EnhancedCalendar } from '@/components/agency/studio/EnhancedCalendar'
import { CalendarActions } from '@/components/agency/studio/CalendarActions'

export default function CalendarPage() {
  return (
    <div className="p-6 space-y-4">
      <CalendarActions />
      <EnhancedCalendar />
    </div>
  )
}
