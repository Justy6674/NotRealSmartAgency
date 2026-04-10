'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import {
  PLATFORM_LABELS,
  PLATFORM_BRAND_COLOURS,
  type PlatformKey,
} from '@/lib/mixpost/ui-tokens'
import { AnalyticsOverview } from '@/components/agency/studio/analytics/AnalyticsOverview'
import { FacebookReport } from '@/components/agency/studio/analytics/reports/FacebookReport'
import { InstagramReport } from '@/components/agency/studio/analytics/reports/InstagramReport'
import { LinkedInReport } from '@/components/agency/studio/analytics/reports/LinkedInReport'
import { TwitterReport } from '@/components/agency/studio/analytics/reports/TwitterReport'
import { TikTokReport } from '@/components/agency/studio/analytics/reports/TikTokReport'
import { YouTubeReport } from '@/components/agency/studio/analytics/reports/YouTubeReport'
import { PinterestReport } from '@/components/agency/studio/analytics/reports/PinterestReport'
import { ThreadsReport } from '@/components/agency/studio/analytics/reports/ThreadsReport'
import { BlueskyReport } from '@/components/agency/studio/analytics/reports/BlueskyReport'
import { MastodonReport } from '@/components/agency/studio/analytics/reports/MastodonReport'

const PLATFORM_TABS: PlatformKey[] = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
  'pinterest',
  'threads',
  'bluesky',
  'mastodon',
]

export default function StudioAnalyticsPage() {
  const { activeBrandId } = useAgencyStore()
  const [tab, setTab] = useState<'overview' | PlatformKey>('overview')

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">
          Select a brand from the sidebar to see analytics.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">
          Platform analytics
        </h2>
        <p className="text-sm text-muted-foreground">
          Cross-platform performance for the last 28 days. Switch tabs to drill
          into a single platform.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as 'overview' | PlatformKey)}
        className="space-y-4"
      >
        <div className="overflow-x-auto">
          <TabsList variant="line" className="h-auto flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            {PLATFORM_TABS.map((platform) => (
              <TabsTrigger
                key={platform}
                value={platform}
                className="gap-1.5"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: PLATFORM_BRAND_COLOURS[platform] }}
                />
                {PLATFORM_LABELS[platform]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview">
          <AnalyticsOverview brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="facebook">
          <FacebookReport brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="instagram">
          <InstagramReport brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="linkedin">
          <LinkedInReport brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="twitter">
          <TwitterReport brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="tiktok">
          <TikTokReport brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="youtube">
          <YouTubeReport brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="pinterest">
          <PinterestReport brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="threads">
          <ThreadsReport brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="bluesky">
          <BlueskyReport brandId={activeBrandId} />
        </TabsContent>
        <TabsContent value="mastodon">
          <MastodonReport brandId={activeBrandId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
