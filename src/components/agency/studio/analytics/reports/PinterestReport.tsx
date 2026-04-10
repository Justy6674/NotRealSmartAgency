'use client'

import { Eye, Bookmark, Users, MousePointerClick } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface PinterestReportProps {
  brandId: string
}

export function PinterestReport({ brandId }: PinterestReportProps) {
  return (
    <PlatformReportShell
      platform="pinterest"
      brandId={brandId}
      timeseriesSeries={['impressions', 'engagement', 'followers']}
      metrics={[
        {
          label: 'Impressions',
          pick: (t) => t.impressions,
          icon: <Eye className="h-3.5 w-3.5" />,
        },
        {
          label: 'Saves',
          pick: (t) => t.saves,
          icon: <Bookmark className="h-3.5 w-3.5" />,
        },
        {
          label: 'Followers',
          pick: (t) => t.followers,
          icon: <Users className="h-3.5 w-3.5" />,
        },
        {
          label: 'Clicks',
          pick: (t) => t.clicks,
          icon: <MousePointerClick className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
