'use client'

import { Eye, Heart, Users, MousePointerClick } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface LinkedInReportProps {
  brandId: string
}

export function LinkedInReport({ brandId }: LinkedInReportProps) {
  return (
    <PlatformReportShell
      platform="linkedin"
      brandId={brandId}
      timeseriesSeries={['impressions', 'engagement', 'followers']}
      metrics={[
        {
          label: 'Impressions',
          pick: (t) => t.impressions,
          icon: <Eye className="h-3.5 w-3.5" />,
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
          label: 'Clicks',
          pick: (t) => t.clicks,
          icon: <MousePointerClick className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
