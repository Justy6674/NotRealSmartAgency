'use client'

import { Heart, Repeat2, MessageCircle, Users } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'
import type { AnalyticsPeriod } from '../analytics-desk'

export interface BlueskyReportProps {
  brandId: string
  /** Passed through so the Director's advice names the business. */
  brandName?: string
  /** How far back to measure — one choice governs the whole screen. */
  period?: AnalyticsPeriod
  /** The account being read, when one is selected in the row above. */
  accountId?: string | null
}

export function BlueskyReport({ brandId, brandName, period, accountId }: BlueskyReportProps) {
  return (
    <PlatformReportShell
      platform="bluesky"
      brandId={brandId}
      brandName={brandName}
      period={period}
      accountId={accountId}
      emptyHint="Bluesky reports engagement only — no reach or impressions — so this page stays to what it actually tells us."
      timeseriesSeries={['engagement', 'followers']}
      metrics={[
        {
          label: 'Likes',
          pick: (t) => t.likes,
          icon: <Heart className="h-3.5 w-3.5" />,
        },
        {
          label: 'Reposts',
          pick: (t) => t.shares,
          icon: <Repeat2 className="h-3.5 w-3.5" />,
        },
        {
          label: 'Replies',
          pick: (t) => t.comments,
          icon: <MessageCircle className="h-3.5 w-3.5" />,
        },
        {
          label: 'Followers',
          pick: (t) => t.followers,
          icon: <Users className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
