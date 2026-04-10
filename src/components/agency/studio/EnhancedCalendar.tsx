'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput, EventDropArg, EventClickArg, EventContentArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { X, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { useScheduledPosts } from '@/hooks/useScheduledPosts'
import { DirectorAssistBar } from './DirectorAssistBar'
import { CalendarPostPill } from './calendar/CalendarPostPill'
import {
  PLATFORM_BRAND_COLOURS,
  POST_STATUS_COLOURS,
  PLATFORM_LABELS,
  type PlatformKey,
  type PostStatusKey,
} from '@/lib/mixpost/ui-tokens'
import type { ScheduledPost } from '@/types/database'

// ─── Platform + status lookups ──────────────────────────────────────────────

function getPlatformColour(platform: string): string {
  return PLATFORM_BRAND_COLOURS[platform as PlatformKey] ?? '#6366f1'
}

function getStatusStyle(status: ScheduledPost['status']) {
  return POST_STATUS_COLOURS[status as PostStatusKey] ?? POST_STATUS_COLOURS.draft
}

// ─── Post detail modal ───────────────────────────────────────────────────────

function PostDetail({
  post,
  onClose,
}: {
  post: ScheduledPost
  onClose: () => void
}) {
  const platformColour = getPlatformColour(post.platform)
  const statusStyle = getStatusStyle(post.status)
  const platformLabel = PLATFORM_LABELS[post.platform as PlatformKey] ?? post.platform

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

        {/* Platform + status badges */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: platformColour, color: '#fff' }}
          >
            {platformLabel}
          </span>
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.fg }}
          >
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
  const router = useRouter()
  const { activeBrandId } = useAgencyStore()
  const studioData = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(studioData.brand, studioData.posts, studioData.accounts)

  // Phase 1 — Mixpost UI port: posts now come from the shared
  // useScheduledPosts hook so every surface (Calendar, Posts Index,
  // Review, Dashboard) shares the same fetch + optimistic mutate path.
  const { posts, loading, reschedulePost } = useScheduledPosts({ brandId: activeBrandId })
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)

  // Convert posts to FullCalendar events. Background/border colours are
  // stripped here because we render each event as a React CalendarPostPill
  // via the eventContent prop — FullCalendar's default box becomes a
  // pass-through container.
  const events: EventInput[] = useMemo(() => {
    return posts.map((post) => ({
      id: post.id,
      title: post.caption.slice(0, 50), // fallback for printing/accessibility
      start: post.scheduled_at,
      allDay: false,
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      textColor: 'inherit',
      extendedProps: { post },
    }))
  }, [posts])

  // Drag-and-drop reschedule — delegates to the hook's optimistic path.
  // On failure, FullCalendar reverts and the hook rolls back its own state.
  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      const post = info.event.extendedProps.post as ScheduledPost
      const newDate = info.event.start
      if (!newDate) {
        info.revert()
        return
      }
      try {
        await reschedulePost(post.id, newDate.toISOString())
      } catch {
        info.revert()
      }
    },
    [reschedulePost],
  )

  // Click on an event → open the detail modal
  const handleEventClick = useCallback((info: EventClickArg) => {
    const post = info.event.extendedProps.post as ScheduledPost
    setSelectedPost(post)
  }, [])

  // Click on an empty time slot → navigate to Creator with pre-filled date/time
  const handleDateClick = useCallback((info: DateClickArg) => {
    const d = info.date
    const dateStr = d.toISOString().slice(0, 10) // YYYY-MM-DD
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    router.push(`/agency/studio/create?date=${dateStr}&time=${timeStr}`)
  }, [router])

  // Custom event renderer — replaces FullCalendar's default event box with
  // our CalendarPostPill React component. FullCalendar mounts the returned
  // node inside its own event wrapper, giving us full control over the
  // visual while keeping drag-drop / keyboard accessibility intact.
  const renderEventContent = useCallback((arg: EventContentArg) => {
    const post = arg.event.extendedProps.post as ScheduledPost | undefined
    if (!post) return null
    const isCompact = arg.view.type !== 'dayGridMonth' ? false : true
    return <CalendarPostPill post={post} onClick={() => setSelectedPost(post)} compact={isCompact} />
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

  const brandName = studioData.brand?.name ?? 'this brand'
  const isHealthBrand = !!(studioData.brand?.compliance_flags?.ahpra || studioData.brand?.compliance_flags?.tga)

  return (
    <div className="space-y-3">
      {/* Director Assist */}
      <DirectorAssistBar
        brandName={brandName}
        buttons={[
          {
            label: 'Fill my week',
            prompt: `Review ${brandName}'s marketing proforma, past posts, and connected social accounts. Then fill every empty day this week with draft posts in ${brandName}'s brand voice.${isHealthBrand ? ' Ensure all content is AHPRA/TGA compliant.' : ''} Use the fill_calendar tool.`,
          },
          {
            label: "What's missing?",
            prompt: `Review ${brandName}'s content calendar for the next 14 days against the strategy pillars in the proforma and the connected social accounts. Identify gaps — which platforms are under-served, which content pillars are missing, and which days have no posts scheduled.${isHealthBrand ? ' Flag any compliance risks.' : ''}`,
          },
        ]}
      />

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
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            editable={true}
            droppable={true}
            eventDrop={handleEventDrop}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            eventContent={renderEventContent}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            height="auto"
            dayMaxEvents={4}
            eventDisplay="block"
            // Week/day view settings — matches Mixpost's CalendarWeek.vue
            // 30-minute slots with now indicator, 24-hour scroll lock
            slotDuration="00:30:00"
            slotLabelInterval="01:00"
            slotLabelFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }}
            nowIndicator={true}
            scrollTime="08:00:00"
            allDaySlot={false}
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

        /* Week/day view — cleaner slot grid */
        .enhanced-calendar .fc .fc-timegrid-slot {
          border-color: hsl(var(--border) / 0.5);
          height: 2.5rem;
        }

        .enhanced-calendar .fc .fc-timegrid-slot-label {
          font-size: 0.7rem;
          color: hsl(var(--muted-foreground));
          vertical-align: top;
          padding-top: 4px;
        }

        .enhanced-calendar .fc .fc-timegrid-col {
          border-color: hsl(var(--border) / 0.3);
        }

        .enhanced-calendar .fc .fc-timegrid-now-indicator-line {
          border-color: oklch(0.55 0.15 250);
          border-width: 2px;
        }

        .enhanced-calendar .fc .fc-timegrid-now-indicator-arrow {
          border-color: oklch(0.55 0.15 250);
        }

        .enhanced-calendar .fc .fc-col-header-cell {
          padding: 8px 4px;
          border-bottom: 2px solid hsl(var(--border));
          background: hsl(var(--muted) / 0.3);
        }

        .enhanced-calendar .fc .fc-col-header-cell.fc-day-today {
          background: hsl(var(--primary) / 0.08);
        }

        .enhanced-calendar .fc .fc-col-header-cell-cushion {
          font-weight: 600;
          letter-spacing: 0.01em;
        }

        /* Clickable empty slots cursor */
        .enhanced-calendar .fc .fc-timegrid-slot-lane {
          cursor: pointer;
        }

        .enhanced-calendar .fc .fc-timegrid-slot-lane:hover {
          background: hsl(var(--primary) / 0.04);
        }

        .enhanced-calendar .fc .fc-daygrid-day:not(.fc-day-disabled) {
          cursor: pointer;
        }

        .enhanced-calendar .fc .fc-daygrid-day:not(.fc-day-disabled):hover {
          background: hsl(var(--primary) / 0.04);
        }
      `}</style>
    </div>
  )
}
