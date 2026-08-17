'use client'

export const dynamic = 'force-dynamic'

import { UnifiedInbox } from '@/components/agency/inbox/UnifiedInbox'

export default function EngagementDepartmentPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <UnifiedInbox />
    </div>
  )
}
