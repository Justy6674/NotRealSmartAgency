'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput, EventDropArg, EventClickArg } from '@fullcalendar/core'
import { X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import type { ScheduledPost } from '@/types/database'

// ─── Platform colours (oklch hue ~240 palette + brand colours) ──────────────

const PLATFORM_COLOURS: Record<string, { bg: string; border: string; text: string }> = {
  instagram:  { bg: 'oklch(0.75 0.15 350)', border: 'oklch(0.65 0.18 350)', text: '#fff' },
  facebook:   { bg: 'oklch(0.60 0.15 260)', border: 'oklch(0.50 0.18 260)', text: '#fff' },
  linkedin:   { bg: 'oklch(0.70 0.12 230)', border: 'oklch(0.58 0.15 230)', text: '#fff' },
  tiktok:     { bg: 'oklch(0.75 0.12 195)', border: 'oklch(0.63 0.15 195)', text: '#fff' },
  youtube:    { bg: 'oklch(0.60 0.20 25)',   border: 'oklch(0.50 0.22 25)',  text: '#fff' },
  twitter:    { bg: 'oklch(0.65 0.02 240)',  border: 'oklch(0.55 0.03 240)', text: '#fff' },
}

function getPlatformColour(platform: string) {
  return PLATFORM_COLOURS[platform.toLowerCase()] ?? {
    bg: 'oklch(0.55 0.02 240)',
    border: 'oklch(0.45 0.03 240)',
    text: '#fff',
  }
}

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-500/20 text-amber-300',
  scheduled: 'bg-blue-500/20 text-blue-300',
  publishing: 'bg-purple-500/20 text-purple-300',
  published: 'bg-emerald-500/20 text-emerald-300',
  failed: 'bg-red-500/20 text-red-300',
  cancelled: 'bg-zinc-500/20 text-zinc-400',
}

// ─── Post detail modal ───────────────────────────────────────────────────────

function PostDetail({
  post,
  onClose,
}: {
  post: ScheduledPost
  onClose: () => void
}) {
  const colour = getPlatformColour(post.platform)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Platform badge */}
        <div className="mb-4 flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold capitalize"
            style={{ backgroundColor: colour.bg, color: colour.text }}
          >
            {post.platform}
          </span>
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[post.status] ?? '')}>
            {post.status}
          </span>
          {post.content_type && (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground capitalize">
              {post.content_type}
            </span>
          )}
        </div>

        {/* Caption */}
        <div className="mb-4 space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Caption
          </h3>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {post.caption.length > 400
              ? post.caption.slice(0, 400) + '...'
              : post.caption}
          </p>
        </div>

        {/* Scheduled time */}
        <div className="mb-4 space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Scheduled for
          </h3>
          <p className="text-sm text-foreground">
            {new Date(post.scheduled_at).toLocaleString('en-AU', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        {/* Hashtags */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="mb-4 space-y-1">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Hashtags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {post.hashtags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* External link */}
        {post.external_post_id && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
            <span>External ID: {post.external_post_id}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Enhanced Calendar ───────────────────────────────────────────────────────

export function EnhancedCalendar() {
  const { activeBrandId } = useAgencyStore()
  const studioData = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(studioData.brand, studioData.posts, studioData.accounts)
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)

  // Fetch posts for the active brand
  const fetchPosts = useCallback(async () => {
    if (!activeBrandId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/scheduled-posts?brandId=${activeBrandId}`)
      if (res.ok) {
        const data: ScheduledPost[] = await res.json()
        setPosts(data)
      }
    } finally {
      setLoading(false)
    }
  }, [activeBrandId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  // Convert posts to FullCalendar events
  const events: EventInput[] = useMemo(() => {
    return posts.map((post) => {
      const colour = getPlatformColour(post.platform)
      return {
        id: post.id,
        title: `${post.platform}: ${post.caption.slice(0, 50)}${post.caption.length > 50 ? '...' : ''}`,
        start: post.scheduled_at,
        allDay: false,
        backgroundColor: colour.bg,
        borderColor: colour.border,
        textColor: colour.text,
        extendedProps: { post },
      }
    })
  }, [posts])

  // Handle drag-and-drop reschedule
  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const post = info.event.extendedProps.post as ScheduledPost
    const newDate = info.event.start

    if (!newDate) {
      info.revert()
      return
    }

    const newScheduledAt = newDate.toISOString()

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, scheduled_at: newScheduledAt } : p
      )
    )

    try {
      const res = await fetch('/api/scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id, scheduled_at: newScheduledAt }),
      })

      if (!res.ok) {
        info.revert()
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, scheduled_at: post.scheduled_at } : p
          )
        )
      }
    } catch {
      info.revert()
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, scheduled_at: post.scheduled_at } : p
        )
      )
    }
  }, [])

  // Handle click to show detail
  const handleEventClick = useCallback((info: EventClickArg) => {
    const post = info.event.extendedProps.post as ScheduledPost
    setSelectedPost(post)
  }, [])

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">
          Select a brand first to view the calendar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Strategy overlay */}
      {strategyContext && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2.5">
          <p className="text-sm text-foreground/80">
            <span className="font-semibold text-foreground">
              {strategyContext.postsThisWeek}/{strategyContext.postsTarget}
            </span>{' '}
            posts this week
          </p>
          <p className="text-xs text-muted-foreground max-w-md truncate">
            {strategyContext.suggestion}
          </p>
        </div>
      )}

      {/* Calendar */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading calendar...</p>
        </div>
      ) : (
        <div className="enhanced-calendar rounded-xl border border-border bg-card p-4">
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            editable={true}
            droppable={true}
            eventDrop={handleEventDrop}
            eventClick={handleEventClick}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,dayGridWeek',
            }}
            height="auto"
            dayMaxEvents={4}
            eventDisplay="block"
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }}
          />
        </div>
      )}

      {/* Post detail modal */}
      {selectedPost && (
        <PostDetail
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {/* FullCalendar theme overrides */}
      <style jsx global>{`
        .enhanced-calendar .fc {
          --fc-border-color: hsl(var(--border));
          --fc-button-bg-color: hsl(var(--secondary));
          --fc-button-border-color: hsl(var(--border));
          --fc-button-hover-bg-color: hsl(var(--muted));
          --fc-button-hover-border-color: hsl(var(--border));
          --fc-button-active-bg-color: hsl(var(--primary));
          --fc-button-active-border-color: hsl(var(--primary));
          --fc-button-text-color: hsl(var(--foreground));
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: hsl(var(--muted));
          --fc-today-bg-color: hsl(var(--primary) / 0.08);
          --fc-event-border-color: transparent;
          font-family: var(--font-ibm-plex-sans), system-ui, sans-serif;
        }

        .enhanced-calendar .fc .fc-toolbar-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: hsl(var(--foreground));
        }

        .enhanced-calendar .fc .fc-col-header-cell-cushion,
        .enhanced-calendar .fc .fc-daygrid-day-number {
          color: hsl(var(--muted-foreground));
          font-size: 0.8125rem;
        }

        .enhanced-calendar .fc .fc-event {
          border-radius: 6px;
          padding: 2px 6px;
          font-size: 0.75rem;
          cursor: pointer;
          border-width: 0;
          border-left-width: 3px;
        }

        .enhanced-calendar .fc .fc-event:hover {
          filter: brightness(1.15);
        }

        .enhanced-calendar .fc .fc-button {
          border-radius: 8px;
          font-size: 0.8125rem;
          padding: 0.35rem 0.75rem;
        }

        .enhanced-calendar .fc .fc-daygrid-more-link {
          color: hsl(var(--primary));
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  )
}
