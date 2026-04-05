'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { useConnectedPlatforms } from '@/hooks/useConnectedPlatforms'
import { StrategyBrief } from './StrategyBrief'
import { DirectorBriefing } from './DirectorBriefing'
import { SocialConnectionsCard } from './SocialConnectionsCard'
import { WeekAtGlance } from './WeekAtGlance'
import { DraftsCard } from './DraftsCard'
import { StrategySummaryCard } from './StrategySummaryCard'
import { CanvaDesignsCard } from './CanvaDesignsCard'
import { VideosCard } from './VideosCard'
import { CompetitorIntelCard } from './CompetitorIntelCard'
import { AgentActivityCard } from './AgentActivityCard'
import { StudioFeed } from './StudioFeed'
import { PostReviewPanel } from './PostReviewPanel'
import type { ScheduledPost } from '@/types/database'

export function StudioDashboard() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)
  const { platforms: connectedPlatforms } = useConnectedPlatforms(activeBrandId)
  const [reviewPosts, setReviewPosts] = useState<ScheduledPost[] | null>(null)

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">
          Select a brand from the sidebar to see your agency dashboard.
        </p>
      </div>
    )
  }

  if (data.loading) {
    return (
      <div className="flex items-center justify-center p-12 gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading studio...</p>
      </div>
    )
  }

  if (data.error || !data.brand) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-red-400">
          {data.error ?? 'Failed to load brand data.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Strategy Brief */}
      <StrategyBrief context={strategyContext} />

      {/* A. Director's Brief — full width hero */}
      <DirectorBriefing
        brand={data.brand}
        analytics={data.analytics}
        posts={data.posts}
        accounts={data.accounts}
      />

      {/* B + C. Social Connections + This Week — 2 columns */}
      <div className="grid gap-4 md:grid-cols-2">
        <SocialConnectionsCard
          brand={data.brand}
          accounts={data.accounts}
          lastPublishedByPlatform={data.lastPublishedByPlatform}
        />
        <WeekAtGlance posts={data.posts} />
      </div>

      {/* D + E. Drafts + Strategy — 2 columns */}
      <div className="grid gap-4 md:grid-cols-2">
        <DraftsCard posts={data.posts} onReviewDrafts={setReviewPosts} />
        <StrategySummaryCard brand={data.brand} />
      </div>

      {/* F. Canva Designs — full width */}
      <CanvaDesignsCard
        configured={data.canva.configured}
        designs={data.canva.designs}
      />

      {/* G. Videos — full width (only if there are videos or it's worth showing) */}
      <VideosCard videos={data.videos} />

      {/* H + I. Competitors + Agent Activity — 2 columns */}
      <div className="grid gap-4 md:grid-cols-2">
        <CompetitorIntelCard brand={data.brand} />
        <AgentActivityCard agentActivity={data.agentActivity} />
      </div>

      {/* J. Recent Content Feed — full width */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground px-1">Recent Content</h3>
        <StudioFeed />
      </div>

      {/* Post Review Panel overlay */}
      {reviewPosts && data.brand && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-8 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-border bg-background p-6">
            <PostReviewPanel
              posts={reviewPosts}
              brand={data.brand}
              connectedPlatforms={connectedPlatforms}
              onClose={() => setReviewPosts(null)}
              onUpdate={() => {
                data.refetch?.()
                setReviewPosts(null)
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
