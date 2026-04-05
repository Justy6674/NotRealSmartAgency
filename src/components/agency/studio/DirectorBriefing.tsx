'use client'

import { useRouter } from 'next/navigation'
import { UserCircle, ArrowRight } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand, ScheduledPost } from '@/types/database'
import type { StudioAnalytics, SocialAccount } from '@/hooks/useStudioData'

interface BriefingItem {
  type: 'alert' | 'suggestion' | 'status'
  text: string
  action?: { label: string; message: string }
}

function buildBriefing(
  brand: Brand,
  analytics: StudioAnalytics,
  posts: ScheduledPost[],
  accounts: SocialAccount[],
): BriefingItem[] {
  const items: BriefingItem[] = []

  // Marketing status unknown
  if (!brand.marketing_status || brand.marketing_status === 'unknown') {
    items.push({
      type: 'suggestion',
      text: `Tell me about ${brand.name} and I'll get your marketing started.`,
      action: { label: 'Get started', message: `Tell me about ${brand.name} — what do we do and who are our customers?` },
    })
    return items // Don't overwhelm new brands with other alerts
  }

  // No posts in last 7 days
  if (analytics.totalPosts === 0) {
    // Check how long since last published post
    const publishedPosts = posts.filter(p => p.status === 'published' && p.published_at)
    if (publishedPosts.length > 0) {
      const lastDate = new Date(publishedPosts[0].published_at!)
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / 86400000)
      if (daysSince >= 3) {
        items.push({
          type: 'alert',
          text: `You haven't posted in ${daysSince} days. Want me to fill your calendar?`,
          action: { label: 'Fill calendar', message: 'Fill my content calendar for the next 7 days' },
        })
      }
    } else {
      items.push({
        type: 'alert',
        text: 'No posts published yet. Let me create your first content.',
        action: { label: 'Create content', message: `Write my first social media post for ${brand.name}` },
      })
    }
  }

  // Drafts waiting
  if (analytics.totalDrafts > 0) {
    items.push({
      type: 'status',
      text: `${analytics.totalDrafts} draft${analytics.totalDrafts > 1 ? 's' : ''} waiting for review.`,
      action: { label: 'Review drafts', message: 'Review and schedule all my draft posts' },
    })
  }

  // Failed posts
  if (analytics.failedPosts > 0) {
    items.push({
      type: 'alert',
      text: `${analytics.failedPosts} post${analytics.failedPosts > 1 ? 's' : ''} failed to publish — I can retry them.`,
      action: { label: 'Retry', message: 'Check my failed posts and retry publishing them' },
    })
  }

  // No strategy
  const strategy = brand.channel_strategy as Record<string, unknown> | null
  if (!strategy?.channels || Object.keys(strategy.channels as object).length === 0) {
    items.push({
      type: 'suggestion',
      text: "Let's build your content strategy — takes 2 minutes.",
      action: { label: 'Build strategy', message: `Help me build a content strategy for ${brand.name}` },
    })
  }

  // No content pillars
  if (!brand.content_pillars || brand.content_pillars.length === 0) {
    items.push({
      type: 'suggestion',
      text: `What topics should ${brand.name} own? Let's define your content pillars.`,
      action: { label: 'Set pillars', message: `Help me define content pillars for ${brand.name}` },
    })
  }

  // Missing platforms in strategy but not connected
  if (strategy?.channels) {
    const strategyPlatforms = Object.keys(strategy.channels as object)
    const connectedPlatforms = accounts.map(a => a.platform.toLowerCase())
    const missing = strategyPlatforms.filter(p => !connectedPlatforms.some(c => c.includes(p)))
    if (missing.length > 0) {
      items.push({
        type: 'suggestion',
        text: `Your strategy includes ${missing.join(', ')} but ${missing.length > 1 ? "they're" : "it's"} not connected yet.`,
        action: { label: 'Connect', message: `Help me connect ${missing.join(' and ')} for ${brand.name}` },
      })
    }
  }

  // Competitors with changes
  const competitors = brand.competitors as Array<{ name: string; last_checked_at?: string }> | null
  if (competitors && competitors.length > 0) {
    const recentlyChanged = competitors.filter(c => {
      if (!c.last_checked_at) return false
      const daysSince = Math.floor((Date.now() - new Date(c.last_checked_at).getTime()) / 86400000)
      return daysSince <= 2
    })
    if (recentlyChanged.length > 0) {
      items.push({
        type: 'alert',
        text: `${recentlyChanged.map(c => c.name).join(', ')} updated their site recently.`,
        action: { label: 'Scan', message: 'Run a deep competitor scan and tell me what changed' },
      })
    }
  }

  // If nothing to say, give an encouraging status
  if (items.length === 0) {
    items.push({
      type: 'status',
      text: `${brand.name} is looking good. ${analytics.totalPosts} posts published this week, ${analytics.totalOutputs} pieces of content created.`,
    })
  }

  return items
}

interface DirectorBriefingProps {
  brand: Brand
  analytics: StudioAnalytics
  posts: ScheduledPost[]
  accounts: SocialAccount[]
}

export function DirectorBriefing({ brand, analytics, posts, accounts }: DirectorBriefingProps) {
  const { setPendingReviewMessage } = useAgencyStore()
  const router = useRouter()

  const items = buildBriefing(brand, analytics, posts, accounts)

  const handleAction = (message: string) => {
    setPendingReviewMessage(message)
    router.push('/agency/chat')
  }

  return (
    <div
      className="rounded-xl p-5 space-y-3"
      style={{
        background: 'oklch(0.14 0.005 240)',
        border: '1px solid oklch(0.25 0.01 240)',
      }}
    >
      {/* Director identity */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
          <UserCircle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Director&apos;s Brief</h3>
          <p className="text-xs text-muted-foreground">{brand.name}</p>
        </div>
      </div>

      {/* Briefing items */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                item.type === 'alert' ? 'bg-red-400' :
                item.type === 'suggestion' ? 'bg-amber-400' :
                'bg-emerald-400'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/90">{item.text}</p>
              {item.action && (
                <button
                  onClick={() => handleAction(item.action!.message)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {item.action.label}
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
