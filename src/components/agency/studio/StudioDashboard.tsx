'use client'

import { useState, useMemo } from 'react'
import { Loader2, CalendarDays, Heart, Trophy, Clock } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { MetricCard } from './analytics/MetricCard'
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
import { SocialAnalyticsCard } from './SocialAnalyticsCard'
import { AgentActivityCard } from './AgentActivityCard'
import { UpcomingPostsCard } from './UpcomingPostsCard'
import { AlertsBanner } from './AlertsBanner'
import { StudioFeed } from './StudioFeed'
import { PostReviewPanel } from './PostReviewPanel'
import { PostDetailPanel } from './PostDetailPanel'
import type { StudioItem } from './StudioFeedCard'
import type { ScheduledPost } from '@/types/database'

/**
 * Headline widget row — Mixpost-Dashboard-style snapshot of activity for
 * the active brand. Counts come from the local `posts` array (already
 * fetched by useStudioData) so this is free of any extra network calls.
 *
 * Engagement totals will hook into the platform analytics endpoint when
 * the source moves direct in Phase 10. For now we surface the most recent
 * published post as the "Top platform" so the row is never empty.
 */
function DashboardWidgets({ posts }: { posts: ScheduledPost[] }) {
  const stats = useMemo(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - 7)
    const startOfMonth = new Date(now)
    startOfMonth.setDate(now.getDate() - 30)

    let postsThisWeek = 0
    let postsThisMonth = 0
    let upcoming = 0
    let mostRecentPublished: ScheduledPost | null = null

    for (const post of posts) {
      const ref = post.published_at ?? post.scheduled_at
      if (!ref) continue
      const refDate = new Date(ref)

      if (post.status === 'published') {
        if (refDate >= startOfWeek) postsThisWeek += 1
        if (refDate >= startOfMonth) postsThisMonth += 1
        const mostRecentRef = mostRecentPublished
          ? mostRecentPublished.published_at ?? mostRecentPublished.scheduled_at
          : null
        if (
          !mostRecentPublished ||
          (mostRecentRef && new Date(mostRecentRef) < refDate)
        ) {
          mostRecentPublished = post
        }
      }

      if (
        (post.status === 'scheduled' || post.status === 'draft') &&
        refDate > now
      ) {
        upcoming += 1
      }
    }

    return { postsThisWeek, postsThisMonth, upcoming, mostRecentPublished }
  }, [posts])

  const topPostLabel = stats.mostRecentPublished
    ? stats.mostRecentPublished.platform.charAt(0).toUpperCase() +
      stats.mostRecentPublished.platform.slice(1)
    : '—'

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
      <MetricCard
        compact
        label="Posts this week"
        value={stats.postsThisWeek}
        icon={<CalendarDays className="h-3.5 w-3.5" />}
      />
      <MetricCard
        compact
        label="Posts this month"
        value={stats.postsThisMonth}
        icon={<Heart className="h-3.5 w-3.5" />}
      />
      <MetricCard
        compact
        label="Top platform (recent)"
        value={topPostLabel}
        icon={<Trophy className="h-3.5 w-3.5" />}
      />
      <MetricCard
        compact
        label="Upcoming scheduled"
        value={stats.upcoming}
        icon={<Clock className="h-3.5 w-3.5" />}
      />
    </div>
  )
}

function postToStudioItem(post: ScheduledPost): StudioItem {
  const postType = post.post_type ?? 'single'
  const mediaCount = post.media_item_ids?.length ?? 0
  const typeLabel = postType === 'carousel' && mediaCount > 1
    ? `${post.platform} carousel (${mediaCount})`
    : `${post.platform} ${postType}`
  return {
    id: `post-${post.id}`,
    type: 'post',
    title: typeLabel,
    caption: post.caption,
    platform: post.platform,
    hashtags: post.hashtags,
    status: post.status,
    scheduledAt: post.scheduled_at,
    createdAt: post.created_at,
    raw: post,
  }
}

export function StudioDashboard() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)
  const { platforms: connectedPlatforms } = useConnectedPlatforms(activeBrandId)
  const [reviewPosts, setReviewPosts] = useState<ScheduledPost[] | null>(null)
  const [editingPost, setEditingPost] = useState<StudioItem | null>(null)

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
      {/* Proactive alerts — failed posts, content gaps, neglected platforms */}
      <AlertsBanner />

      {/* Mixpost-style headline widgets — week/month at a glance */}
      <DashboardWidgets posts={data.posts} />

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

      {/* D. Upcoming Posts + Drafts — 2 columns */}
      <div className="grid gap-4 md:grid-cols-2">
        <UpcomingPostsCard
          posts={data.posts}
          onSelectPost={(post) => setEditingPost(postToStudioItem(post))}
        />
        <DraftsCard posts={data.posts} onReviewDrafts={setReviewPosts} />
      </div>

      {/* E. Strategy — full width */}
      <StrategySummaryCard brand={data.brand} />

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

      {/* Social Analytics — full width */}
      <SocialAnalyticsCard />

      {/* J. Recent Content Feed — full width */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground px-1">Recent Content</h3>
        <StudioFeed />
      </div>

      {/* Post Edit Panel overlay */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30">
          <div className="h-full w-full max-w-md border-l border-border bg-background overflow-y-auto">
            <PostDetailPanel
              item={editingPost}
              onClose={() => setEditingPost(null)}
              onUpdated={() => {
                data.refetch?.()
                setEditingPost(null)
              }}
            />
          </div>
        </div>
      )}

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
