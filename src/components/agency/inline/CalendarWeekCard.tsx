'use client'

import { useState } from 'react'
import {
  Calendar,
  Instagram,
  Facebook,
  Linkedin,
  Twitter,
  Youtube,
  CalendarDays,
  Check,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Platform Config ──────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: CalendarDays,
  youtube: Youtube,
}

const PLATFORM_COLOURS: Record<string, string> = {
  instagram: 'text-pink-400',
  facebook: 'text-blue-400',
  linkedin: 'text-sky-400',
  twitter: 'text-zinc-400',
  tiktok: 'text-cyan-400',
  youtube: 'text-red-400',
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'text-amber-400' },
  scheduled: { label: 'Sched', className: 'text-blue-400' },
  published: { label: 'Live', className: 'text-emerald-400' },
  failed: { label: 'Failed', className: 'text-red-400' },
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarWeekPost {
  day: string
  platform: string
  caption: string
  status: string
  id: string
}

export interface CalendarWeekCardProps {
  posts: CalendarWeekPost[]
  title?: string
  onApproveAll?: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

export function CalendarWeekCard({ posts, title, onApproveAll }: CalendarWeekCardProps) {
  const [approveState, setApproveState] = useState<'idle' | 'approving' | 'approved'>('idle')

  const draftCount = posts.filter(p => p.status.toLowerCase() === 'draft').length

  const handleApproveAll = () => {
    setApproveState('approving')
    onApproveAll?.()
    setTimeout(() => setApproveState('approved'), 800)
  }

  // Group posts by day to handle multiple posts on same day
  const DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const postsByDay = new Map<string, CalendarWeekPost[]>()
  for (const post of posts) {
    const day = post.day
    if (!postsByDay.has(day)) postsByDay.set(day, [])
    postsByDay.get(day)!.push(post)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 my-2 max-w-md">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-foreground">{title ?? 'This Week'}</span>
      </div>

      {/* Day rows */}
      <div className="space-y-1">
        {DAYS_ORDER.map((day) => {
          const dayPosts = postsByDay.get(day)

          if (!dayPosts || dayPosts.length === 0) {
            return (
              <div key={day} className="flex items-center gap-3 py-1.5">
                <span className="text-xs font-medium text-muted-foreground w-8">{day}</span>
                <span className="text-xs text-muted-foreground/40">&mdash;</span>
              </div>
            )
          }

          return dayPosts.map((post, i) => {
            const PlatformIcon = PLATFORM_ICONS[post.platform.toLowerCase()] ?? CalendarDays
            const platformColour = PLATFORM_COLOURS[post.platform.toLowerCase()] ?? 'text-muted-foreground'
            const statusBadge = STATUS_BADGES[post.status.toLowerCase()] ?? STATUS_BADGES.draft

            // Truncate caption for the row
            const shortCaption = post.caption.length > 32
              ? `${post.caption.slice(0, 32)}...`
              : post.caption

            return (
              <div key={`${day}-${i}`} className="flex items-center gap-3 py-1.5">
                {/* Day label — only show for first post on that day */}
                <span className="text-xs font-medium text-muted-foreground w-8">
                  {i === 0 ? day : ''}
                </span>
                {/* Platform icon */}
                <PlatformIcon className={cn('h-3.5 w-3.5 shrink-0', platformColour)} />
                {/* Caption snippet */}
                <span className="text-xs text-foreground flex-1 truncate">
                  &ldquo;{shortCaption}&rdquo;
                </span>
                {/* Status */}
                <span className={cn('text-[10px] font-medium shrink-0', statusBadge.className)}>
                  {statusBadge.label}
                </span>
              </div>
            )
          })
        })}
      </div>

      {/* Footer */}
      {draftCount > 0 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground">
            {draftCount} {draftCount === 1 ? 'draft needs' : 'drafts need'} approval
          </span>
          {onApproveAll && (
            <button
              onClick={handleApproveAll}
              disabled={approveState !== 'idle'}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                approveState === 'approved'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                approveState === 'approving' && 'opacity-70',
              )}
            >
              {approveState === 'approving' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : approveState === 'approved' ? (
                <Check className="h-3 w-3" />
              ) : null}
              {approveState === 'approved' ? 'All approved' : 'Approve all drafts'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
