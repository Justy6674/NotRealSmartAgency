'use client'

import { Calendar, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScheduledPost } from '@/types/database'

const PLATFORM_COLOURS: Record<string, string> = {
  instagram: 'bg-pink-400',
  facebook: 'bg-blue-400',
  linkedin: 'bg-sky-400',
  tiktok: 'bg-cyan-400',
  youtube: 'bg-red-400',
  twitter: 'bg-zinc-400',
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-blue-500/15 text-blue-400',
  publishing: 'bg-amber-500/15 text-amber-400',
  published: 'bg-emerald-500/15 text-emerald-400',
  draft: 'bg-muted text-muted-foreground',
}

function formatSchedule(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMs < 0) return 'Overdue'
  if (diffHours < 1) return 'Soon'
  if (diffHours < 24) return `In ${diffHours}h`
  if (diffDays < 7) {
    return date.toLocaleDateString('en-AU', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
  }
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

interface UpcomingPostsCardProps {
  posts: ScheduledPost[]
  onSelectPost: (post: ScheduledPost) => void
}

export function UpcomingPostsCard({ posts, onSelectPost }: UpcomingPostsCardProps) {
  const upcoming = posts
    .filter(p => ['scheduled', 'publishing'].includes(p.status))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 5)

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-foreground">Upcoming Posts</h3>
        </div>
        {upcoming.length > 0 && (
          <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium text-blue-400">
            {upcoming.length}
          </span>
        )}
      </div>

      {upcoming.length === 0 ? (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground">No posts scheduled yet.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {upcoming.map(post => (
            <button
              key={post.id}
              type="button"
              onClick={() => onSelectPost(post)}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted/50 transition-colors"
            >
              {/* Platform dot */}
              <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', PLATFORM_COLOURS[post.platform] ?? 'bg-zinc-500')} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground line-clamp-1">
                  {post.caption?.slice(0, 80) || 'No caption'}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatSchedule(post.scheduled_at)}
                  </span>
                  <span className={cn('rounded-full px-1.5 py-px text-[9px] font-medium', STATUS_STYLES[post.status] ?? 'bg-muted text-muted-foreground')}>
                    {post.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
