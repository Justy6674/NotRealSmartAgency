'use client'

import { useRouter } from 'next/navigation'
import { FileText, ArrowRight } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import type { ScheduledPost } from '@/types/database'

const PLATFORM_ICONS: Record<string, string> = {
  instagram: '📸',
  facebook: '📘',
  linkedin: '💼',
  twitter: '𝕏',
  tiktok: '🎵',
  youtube: '▶️',
}

interface DraftsCardProps {
  posts: ScheduledPost[]
  onReviewDrafts?: (posts: ScheduledPost[]) => void
}

export function DraftsCard({ posts, onReviewDrafts }: DraftsCardProps) {
  const { setPendingReviewMessage } = useAgencyStore()
  const router = useRouter()

  const allDrafts = posts.filter(p => p.status === 'draft')
  const drafts = [...allDrafts]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const totalDrafts = allDrafts.length

  const handleReviewAll = () => {
    if (onReviewDrafts) {
      onReviewDrafts(allDrafts)
    } else {
      setPendingReviewMessage('Review and schedule all my draft posts')
      router.push('/agency/chat')
    }
  }

  const handleCreate = () => {
    setPendingReviewMessage('Write me some social media posts')
    router.push('/agency/chat')
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Drafts
          {totalDrafts > 0 && (
            <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              {totalDrafts}
            </span>
          )}
        </h3>
        {totalDrafts > 0 && (
          <button
            onClick={handleReviewAll}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
          >
            Review all
            <ArrowRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground mb-2">No drafts — ask the Director to create content.</p>
          <button
            onClick={handleCreate}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Create content
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {drafts.map(draft => (
            <div
              key={draft.id}
              role="button"
              tabIndex={0}
              onClick={() => onReviewDrafts?.(allDrafts)}
              onKeyDown={e => { if (e.key === 'Enter') onReviewDrafts?.(allDrafts) }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <span className="shrink-0 text-sm">
                {PLATFORM_ICONS[draft.platform] ?? '📄'}
              </span>
              <span className="text-sm text-foreground/80 truncate flex-1">
                {draft.caption?.slice(0, 60) || 'Empty draft'}
              </span>
              {draft.scheduled_at && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(draft.scheduled_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
