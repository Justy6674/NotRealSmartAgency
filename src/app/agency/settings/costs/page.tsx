'use client'

export const dynamic = 'force-dynamic'

import { CostDashboard } from '@/components/agency/CostDashboard'

export default function SettingsCostsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold text-foreground mb-4">What it costs</h1>
      <CostDashboard />
    </div>
  )
}
