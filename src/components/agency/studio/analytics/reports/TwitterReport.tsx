'use client'

import { Eye, Heart, Users, MessageCircle } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface TwitterReportProps {
  brandId: string
}

export function TwitterReport({ brandId }: TwitterReportProps) {
  return (
    <PlatformReportShell
      platform="twitter"
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
          label: 'Profile visits',
          pick: (t) => t.profileVisits,
          icon: <MessageCircle className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
