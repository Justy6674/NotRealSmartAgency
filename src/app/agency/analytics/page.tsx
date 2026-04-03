'use client'

export const dynamic = 'force-dynamic'

import { AnalyticsDashboard } from '@/components/agency/AnalyticsDashboard'

export default function AnalyticsPage() {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-lg font-semibold text-foreground mb-4">Performance Analytics</h1>
      <AnalyticsDashboard />
    </div>
  )
}
