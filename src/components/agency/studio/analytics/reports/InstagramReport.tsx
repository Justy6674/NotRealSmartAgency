'use client'

import { Eye, Heart, Users, Bookmark } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'
import type { AnalyticsPeriod } from '../analytics-desk'

export interface InstagramReportProps {
  brandId: string
  /** Passed through so the Director's advice names the business. */
  brandName?: string
  /** How far back to measure — one choice governs the whole screen. */
  period?: AnalyticsPeriod
  /** The account being read, when one is selected in the row above. */
  accountId?: string | null
}

export function InstagramReport({ brandId, brandName, period, accountId }: InstagramReportProps) {
  return (
    <PlatformReportShell
      platform="instagram"
      brandId={brandId}
      brandName={brandName}
      period={period}
      accountId={accountId}
      timeseriesSeries={['reach', 'impressions', 'engagement', 'followers']}
      metrics={[
        {
          label: 'Reach',
          pick: (t) => t.reach,
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
          label: 'Saves',
          pick: (t) => t.saves,
          icon: <Bookmark className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
