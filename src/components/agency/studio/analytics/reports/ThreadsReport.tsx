'use client'

import { Eye, MessageCircle, Repeat2, Heart } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface ThreadsReportProps {
  brandId: string
}

export function ThreadsReport({ brandId }: ThreadsReportProps) {
  return (
    <PlatformReportShell
      platform="threads"
      brandId={brandId}
      emptyHint="Threads analytics are limited via public APIs. Once Meta exposes more metrics, we'll surface them here automatically."
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
