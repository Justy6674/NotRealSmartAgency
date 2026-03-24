'use client'

export const dynamic = 'force-dynamic'

import { CostDashboard } from '@/components/agency/CostDashboard'

export default function CostsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold text-foreground mb-4">Cost Dashboard</h1>
      <CostDashboard />
    </div>
  )
}
