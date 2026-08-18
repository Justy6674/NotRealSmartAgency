'use client'

import { Play, Heart, Users, Share2 } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'
import type { AnalyticsPeriod } from '../analytics-desk'

export interface TikTokReportProps {
  brandId: string
  /** Passed through so the Director's advice names the business. */
  brandName?: string
  /** How far back to measure — one choice governs the whole screen. */
  period?: AnalyticsPeriod
  /** The account being read, when one is selected in the row above. */
  accountId?: string | null
}

export function TikTokReport({ brandId, brandName, period, accountId }: TikTokReportProps) {
  return (
    <PlatformReportShell
      platform="tiktok"
      brandId={brandId}
      brandName={brandName}
      period={period}
      accountId={accountId}
      timeseriesSeries={['videoViews', 'engagement', 'followers']}
      metrics={[
        {
          label: 'Video views',
          pick: (t) => t.videoViews,
          icon: <Play className="h-3.5 w-3.5" />,
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
          label: 'Shares',
          pick: (t) => t.shares,
          icon: <Share2 className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
