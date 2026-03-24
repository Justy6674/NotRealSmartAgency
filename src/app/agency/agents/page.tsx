'use client'

export const dynamic = 'force-dynamic'

import { AgentDashboard } from '@/components/agency/AgentDashboard'

export default function AgentsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold text-foreground mb-4">Agent Organisation</h1>
      <AgentDashboard />
    </div>
  )
}
