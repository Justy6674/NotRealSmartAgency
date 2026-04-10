'use client'

import { Play, Heart, Users, Share2 } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface TikTokReportProps {
  brandId: string
}

export function TikTokReport({ brandId }: TikTokReportProps) {
  return (
    <PlatformReportShell
      platform="tiktok"
      brandId={brandId}
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
