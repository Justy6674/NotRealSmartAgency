'use client'

import { Star, Repeat2, MessageCircle, Users } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'
import type { AnalyticsPeriod } from '../analytics-desk'

export interface MastodonReportProps {
  brandId: string
  /** Passed through so the Director's advice names the business. */
  brandName?: string
  /** How far back to measure — one choice governs the whole screen. */
  period?: AnalyticsPeriod
  /** The account being read, when one is selected in the row above. */
  accountId?: string | null
}

export function MastodonReport({ brandId, brandName, period, accountId }: MastodonReportProps) {
  return (
    <PlatformReportShell
      platform="mastodon"
      brandId={brandId}
      brandName={brandName}
      period={period}
      accountId={accountId}
      emptyHint="What Mastodon reports depends on the server your account is on: favourites, boosts and replies, and not always reach."
      timeseriesSeries={['engagement', 'followers']}
      metrics={[
        {
          label: 'Favourites',
          pick: (t) => t.likes,
          icon: <Star className="h-3.5 w-3.5" />,
        },
        {
          label: 'Boosts',
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
