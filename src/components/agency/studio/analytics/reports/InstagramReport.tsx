'use client'

import { Eye, Heart, Users, Bookmark } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface InstagramReportProps {
  brandId: string
}

export function InstagramReport({ brandId }: InstagramReportProps) {
  return (
    <PlatformReportShell
      platform="instagram"
      brandId={brandId}
      timeseriesSeries={['reach', 'impressions', 'engagement', 'followers']}
      metrics={[
        {
          label: 'Reach',
          pick: (t) => t.reach,
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
          label: 'Saves',
          pick: (t) => t.saves,
          icon: <Bookmark className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
