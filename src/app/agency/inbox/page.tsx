'use client'

export const dynamic = 'force-dynamic'

import { UnifiedInbox } from '@/components/agency/inbox/UnifiedInbox'

export default function InboxPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <UnifiedInbox />
    </div>
  )
}
