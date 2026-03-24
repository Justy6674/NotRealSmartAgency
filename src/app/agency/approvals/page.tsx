'use client'

export const dynamic = 'force-dynamic'

import { ApprovalList } from '@/components/agency/ApprovalList'

export default function ApprovalsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold text-foreground mb-4">Approval Queue</h1>
      <ApprovalList />
    </div>
  )
}
