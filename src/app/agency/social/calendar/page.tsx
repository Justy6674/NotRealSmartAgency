'use client'

export const dynamic = 'force-dynamic'

import { EnhancedCalendar } from '@/components/agency/studio/EnhancedCalendar'
import { CalendarActions } from '@/components/agency/studio/CalendarActions'

/**
 * The department shell already supplies the scrolling, padded pane (18/26/26)
 * — it is the only scroller in Social. Wrapping this screen in a second
 * `overflow-y-auto` gave it two scrollbars and doubled the side padding.
 */
export default function SocialCalendarPage() {
  return (
    <div className="space-y-4">
      {/* The two week-level actions. The content-type chips that used to sit
          beside them moved into the calendar itself, where the list they filter
          actually lives — here they had no handler and could never do anything. */}
      <CalendarActions />
      <EnhancedCalendar />
    </div>
  )
}
