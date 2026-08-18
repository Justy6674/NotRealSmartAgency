'use client'

import { Play, Clock, Users, ThumbsUp } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'
import type { AnalyticsPeriod } from '../analytics-desk'

export interface YouTubeReportProps {
  brandId: string
  /** Passed through so the Director's advice names the business. */
  brandName?: string
  /** How far back to measure — one choice governs the whole screen. */
  period?: AnalyticsPeriod
  /** The account being read, when one is selected in the row above. */
  accountId?: string | null
}

export function YouTubeReport({ brandId, brandName, period, accountId }: YouTubeReportProps) {
  return (
    <PlatformReportShell
      platform="youtube"
      brandId={brandId}
      brandName={brandName}
      period={period}
      accountId={accountId}
      timeseriesSeries={['videoViews', 'followers']}
      metrics={[
        {
          label: 'Video views',
          pick: (t) => t.videoViews,
          icon: <Play className="h-3.5 w-3.5" />,
        },
        {
          label: 'Watch time (s)',
          pick: (t) => t.watchTimeSeconds,
          icon: <Clock className="h-3.5 w-3.5" />,
        },
        {
          label: 'Subscribers',
          pick: (t) => t.followers,
          icon: <Users className="h-3.5 w-3.5" />,
        },
        {
          label: 'Likes',
          pick: (t) => t.likes,
          icon: <ThumbsUp className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
