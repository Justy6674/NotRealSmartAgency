'use client'

import { Eye, Heart, Users, MousePointerClick } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'
import type { AnalyticsPeriod } from '../analytics-desk'

export interface LinkedInReportProps {
  brandId: string
  /** Passed through so the Director's advice names the business. */
  brandName?: string
  /** How far back to measure — one choice governs the whole screen. */
  period?: AnalyticsPeriod
  /** The account being read, when one is selected in the row above. */
  accountId?: string | null
}

export function LinkedInReport({ brandId, brandName, period, accountId }: LinkedInReportProps) {
  return (
    <PlatformReportShell
      platform="linkedin"
      brandId={brandId}
      brandName={brandName}
      period={period}
      accountId={accountId}
      timeseriesSeries={['impressions', 'engagement', 'followers']}
      metrics={[
        {
          label: 'Impressions',
          pick: (t) => t.impressions,
          icon: <Eye className="h-3.5 w-3.5" />,
        },
        {
          label: 'Engagement',
          pick: (t) => t.engagement,
          icon: <Heart className="h-3.5 w-3.5" />,
        },
        {
          label: 'Followers',
          pick: (t) => t.followers,
          icon: <Users className="h-3.5 w-3.5" />,
        },
        {
          label: 'Clicks',
          pick: (t) => t.clicks,
          icon: <MousePointerClick className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
