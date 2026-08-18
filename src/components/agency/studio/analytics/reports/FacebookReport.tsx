'use client'

import { Eye, Heart, Users, MousePointerClick } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'
import type { AnalyticsPeriod } from '../analytics-desk'

export interface FacebookReportProps {
  brandId: string
  /** Passed through so the Director's advice names the business. */
  brandName?: string
  /** How far back to measure — one choice governs the whole screen. */
  period?: AnalyticsPeriod
  /** The account being read, when one is selected in the row above. */
  accountId?: string | null
}

export function FacebookReport({ brandId, brandName, period, accountId }: FacebookReportProps) {
  return (
    <PlatformReportShell
      platform="facebook"
      brandId={brandId}
      brandName={brandName}
      period={period}
      accountId={accountId}
      timeseriesSeries={['reach', 'engagement', 'followers']}
      metrics={[
        {
          label: 'Page reach',
          pick: (t) => t.reach,
          icon: <Eye className="h-3.5 w-3.5" />,
        },
        {
          label: 'Engagement',
          pick: (t) => t.engagement,
          icon: <Heart className="h-3.5 w-3.5" />,
        },
        {
          label: 'Page followers',
          pick: (t) => t.followers,
          icon: <Users className="h-3.5 w-3.5" />,
        },
        {
          label: 'Link clicks',
          pick: (t) => t.clicks,
          icon: <MousePointerClick className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
