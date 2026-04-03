export const dynamic = 'force-dynamic'

import { ContentCalendar } from '@/components/agency/ContentCalendar'

export default function CalendarPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Content Calendar</h1>
      <ContentCalendar />
    </div>
  )
}
