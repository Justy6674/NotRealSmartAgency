'use client'

import { Star, Repeat2, MessageCircle, Users } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface MastodonReportProps {
  brandId: string
}

export function MastodonReport({ brandId }: MastodonReportProps) {
  return (
    <PlatformReportShell
      platform="mastodon"
      brandId={brandId}
      emptyHint="Mastodon analytics depend on the instance — boosts, favourites and replies only. Coming soon — instance-aware reach when supported."
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
