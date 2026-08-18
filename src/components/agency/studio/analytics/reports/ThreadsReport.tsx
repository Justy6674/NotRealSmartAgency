'use client'

import { Eye, MessageCircle, Repeat2, Heart } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'
import type { AnalyticsPeriod } from '../analytics-desk'

export interface ThreadsReportProps {
  brandId: string
  /** Passed through so the Director's advice names the business. */
  brandName?: string
  /** How far back to measure — one choice governs the whole screen. */
  period?: AnalyticsPeriod
  /** The account being read, when one is selected in the row above. */
  accountId?: string | null
}

export function ThreadsReport({ brandId, brandName, period, accountId }: ThreadsReportProps) {
  return (
    <PlatformReportShell
      platform="threads"
      brandId={brandId}
      brandName={brandName}
      period={period}
      accountId={accountId}
      emptyHint="Threads shares far fewer figures with outside tools than Instagram does, so this stays thinner than the rest. Anything it does share appears here on its own."
      timeseriesSeries={['impressions', 'engagement']}
      metrics={[
        {
          label: 'Views',
          pick: (t) => t.impressions,
          icon: <Eye className="h-3.5 w-3.5" />,
        },
        {
          label: 'Replies',
          pick: (t) => t.comments,
          icon: <MessageCircle className="h-3.5 w-3.5" />,
        },
        {
          label: 'Reposts',
          pick: (t) => t.shares,
          icon: <Repeat2 className="h-3.5 w-3.5" />,
        },
        {
          label: 'Likes',
          pick: (t) => t.likes,
          icon: <Heart className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
