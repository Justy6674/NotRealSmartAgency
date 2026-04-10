'use client'

import { Play, Clock, Users, ThumbsUp } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface YouTubeReportProps {
  brandId: string
}

export function YouTubeReport({ brandId }: YouTubeReportProps) {
  return (
    <PlatformReportShell
      platform="youtube"
      brandId={brandId}
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
