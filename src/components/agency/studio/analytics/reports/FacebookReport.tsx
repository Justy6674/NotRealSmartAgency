'use client'

import { Eye, Heart, Users, MousePointerClick } from 'lucide-react'
import { PlatformReportShell } from './PlatformReportShell'

export interface FacebookReportProps {
  brandId: string
}

export function FacebookReport({ brandId }: FacebookReportProps) {
  return (
    <PlatformReportShell
      platform="facebook"
      brandId={brandId}
      timeseriesSeries={['reach', 'engagement', 'followers']}
      metrics={[
        {
          label: 'Page reach',
          pick: (t) => t.reach,
          icon: <Eye className="h-3.5 w-3.5" />,
        },
        {
          label: 'Engagement',
          pick: (t) => t.engagement,
          icon: <Heart className="h-3.5 w-3.5" />,
        },
        {
          label: 'Page followers',
          pick: (t) => t.followers,
          icon: <Users className="h-3.5 w-3.5" />,
        },
        {
          label: 'Link clicks',
          pick: (t) => t.clicks,
          icon: <MousePointerClick className="h-3.5 w-3.5" />,
        },
      ]}
    />
  )
}
