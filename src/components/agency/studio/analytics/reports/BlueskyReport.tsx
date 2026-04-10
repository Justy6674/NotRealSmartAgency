'use client'

import { Heart, Repeat2, MessageCircle, Users } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface BlueskyReportProps {
  brandId: string
}

export function BlueskyReport({ brandId }: BlueskyReportProps) {
  return (
    <PlatformReportShell
      platform="bluesky"
      brandId={brandId}
      emptyHint="Bluesky's public API exposes basic engagement only. Coming soon — deeper metrics once the AT Protocol stabilises analytics endpoints."
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
