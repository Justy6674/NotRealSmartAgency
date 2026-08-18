'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventInput, EventDropArg, EventClickArg, EventContentArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { ChevronDown } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { useScheduledPosts } from '@/hooks/useScheduledPosts'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { DirectorAssistBar } from './DirectorAssistBar'
import { CalendarPostPill } from './calendar/CalendarPostPill'
import { PostsFilters } from './posts/PostsFilters'
import { PostPreviewModal } from './posts/PostPreviewModal'
import { CONTENT_TYPES, type ContentTypeFilter } from './CalendarActions'
import type { PostsListFilters, SocialPostRow } from '@/hooks/usePostsList'

type CalendarView = 'dayGridMonth' | 'timeGridWeek'

const VIEW_LABELS: Record<CalendarView, string> = {
  dayGridMonth: 'Month',
  timeGridWeek: 'Week',
}

/**
 * The calendar.
 *
 * Two views and one toolbar, matching Mixpost — and the toolbar is literally
 * the Posts page's filter component rather than a second one that drifts. The
 * view switch is a dropdown, not a segmented toggle, for the same reason
 * Mixpost's is: two options do not earn a permanent row of buttons.
 *
 * Drag to reschedule stays, and it is the one thing here Mixpost genuinely
 * cannot do — `grep -rn 'draggable\|dragstart' Components/Calendar/` in its own
 * source returns nothing. "Exactly Mixpost" was never an instruction to remove
 * something better that already works. Posts published before the account was
 * connected here are not draggable, because there is nothing on the other end
 * to move.
 */
export function EnhancedCalendar() {
  const router = useRouter()
  const { activeBrandId } = useAgencyStore()
  const studioData = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(studioData.brand, studioData.posts, studioData.accounts)

  const { posts, loading, reschedulePost } = useScheduledPosts({ brandId: activeBrandId })
  const [selectedPost, setSelectedPost] = useState<SocialPostRow | null>(null)
  const [view, setView] = useState<CalendarView>('dayGridMonth')
  const [filters, setFilters] = useState<PostsListFilters>({})
  const [contentTypes, setContentTypes] = useState<ContentTypeFilter[]>([])
  const calendarRef = useRef<FullCalendar | null>(null)

  const labels = useMemo(() => {
    const byId = new Map(posts.flatMap((post) => post.labels.map((label) => [label.id, label])))
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [posts])

  const accounts = useMemo(() => {
    const byId = new Map(posts.flatMap((post) => post.accounts.map((account) => [account.id, account])))
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [posts])

  const visible = useMemo(() => {
    let rows = posts

    if (filters.platforms?.length) {
      const set = new Set(filters.platforms)
      rows = rows.filter((post) => post.platforms.some((platform) => set.has(platform)))
    }
    if (filters.labelIds?.length) {
      const set = new Set(filters.labelIds)
      rows = rows.filter((post) => post.labels.some((label) => set.has(label.id)))
    }
    if (filters.accountIds?.length) {
      const set = new Set(filters.accountIds)
      rows = rows.filter((post) => post.accounts.some((account) => set.has(account.id)))
    }
    if (filters.search?.trim()) {
      const needle = filters.search.trim().toLowerCase()
      rows = rows.filter((post) => post.caption.toLowerCase().includes(needle))
    }
    if (filters.from) {
      rows = rows.filter((post) => (post.scheduled_at ?? post.published_at ?? '') >= filters.from!)
    }
    if (filters.to) {
      // The bound is a date, so it has to reach the end of that day or a post at
      // 4pm on the closing date disappears from its own range.
      const end = `${filters.to}T23:59:59`
      rows = rows.filter((post) => (post.scheduled_at ?? post.published_at ?? '') <= end)
    }
    if (contentTypes.length > 0) {
      const set = new Set<string>(contentTypes)
      rows = rows.filter((post) => {
        const type = post.metadata.content_type
        return typeof type === 'string' && set.has(type)
      })
    }

    return rows
  }, [posts, filters, contentTypes])

  const events: EventInput[] = useMemo(
    () =>
      visible.map((post) => ({
        id: post.id,
        title: post.caption.slice(0, 50),
        start: post.scheduled_at ?? post.published_at ?? undefined,
        allDay: false,
        backgroundColor: 'transparent',
        borderColor: 'transparent',
        textColor: 'inherit',
        // History has no row here to move, so it is not draggable. A drag that
        // silently snaps back is a worse answer than one that never starts.
        editable: post.origin === 'desk',
        extendedProps: { post },
      })),
    [visible],
  )

  const handleEventDrop = useCallback(
    async (info: EventDropArg) => {
      const post = info.event.extendedProps.post as SocialPostRow
      const newDate = info.event.start
      if (!newDate || post.origin !== 'desk') {
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

  const handleEventClick = useCallback((info: EventClickArg) => {
    setSelectedPost(info.event.extendedProps.post as SocialPostRow)
  }, [])

  // An empty cell prefills the composer. It used to push /agency/studio/create,
  // which drops the whole Social chrome the owner was standing in.
  const handleDateClick = useCallback(
    (info: DateClickArg) => {
      const d = info.date
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      router.push(`/agency/social/compose?date=${dateStr}&time=${timeStr}`)
    },
    [router],
  )

  const renderEventContent = useCallback((arg: EventContentArg) => {
    const post = arg.event.extendedProps.post as SocialPostRow | undefined
    if (!post) return null
    return (
      <CalendarPostPill
        post={post}
        onClick={() => setSelectedPost(post)}
        compact={arg.view.type === 'dayGridMonth'}
      />
    )
  }, [])

  const changeView = useCallback((next: CalendarView) => {
    setView(next)
    calendarRef.current?.getApi().changeView(next)
  }, [])

  const toggleContentType = useCallback((type: ContentTypeFilter) => {
    setContentTypes((prev) =>
      prev.includes(type) ? prev.filter((entry) => entry !== type) : [...prev, type],
    )
  }, [])

  if (!activeBrandId) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-muted-foreground">
          Pick a business first to see its calendar.
        </p>
      </div>
    )
  }

  const brandName = studioData.brand?.name ?? 'this business'
  const isHealthBrand = !!(
    studioData.brand?.compliance_flags?.ahpra || studioData.brand?.compliance_flags?.tga
  )

  return (
    <div className="space-y-3">
      <DirectorAssistBar
        brandName={brandName}
        buttons={[
          {
            label: 'Fill my week',
            prompt: `Review ${brandName}'s marketing proforma, past posts, and connected social accounts. Then fill every empty day this week with draft posts in ${brandName}'s brand voice.${
              isHealthBrand ? ' Ensure all content is AHPRA/TGA compliant.' : ''
            } Use the fill_calendar tool.`,
          },
          {
            label: "What's missing?",
            prompt: `Review ${brandName}'s content calendar for the next 14 days against the strategy pillars in the proforma and the connected social accounts. Identify gaps — which platforms are under-served, which content pillars are missing, and which days have no posts scheduled.${
              isHealthBrand ? ' Flag any compliance risks.' : ''
            }`,
          },
        ]}
      />

      {/* Toolbar: view switch + the same filter component the Posts list uses. */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => (
              <Button {...props} variant="outline" size="sm">
                {VIEW_LABELS[view]}
                <ChevronDown className="ml-1" />
              </Button>
            )}
          />
          <DropdownMenuContent align="start" className="w-36">
            <DropdownMenuRadioGroup
              value={view}
              onValueChange={(value) => changeView(value as CalendarView)}
            >
              <DropdownMenuRadioItem value="dayGridMonth">Month</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="timeGridWeek">Week</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <PostsFilters
          filters={filters}
          onChange={setFilters}
          labels={labels}
          accounts={accounts}
          compact
        />
      </div>

      {/* Content-type chips. These used to be rendered with no handler at all —
          four buttons that could never highlight and never filter. They are
          wired to the same list the calendar draws from now. */}
      <div className="flex flex-wrap items-center gap-2">
        {CONTENT_TYPES.map((type) => {
          const active = contentTypes.includes(type.id)
          return (
            <button
              key={type.id}
              type="button"
              onClick={() => toggleContentType(type.id)}
              aria-pressed={active}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={
                active
                  ? {
                      background: 'var(--brand-wash, oklch(0.966 0.0068 240))',
                      color: 'var(--brand-deep, currentColor)',
                      fontWeight: 600,
                    }
                  : { background: 'var(--panel-2, transparent)', color: 'var(--ink-2, inherit)' }
              }
            >
              {type.label}
            </button>
          )
        })}
        {contentTypes.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setContentTypes([])}>
            Show all kinds
          </Button>
        )}
      </div>

      {strategyContext && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2.5">
          <p className="text-sm text-foreground/80">
            <span className="font-semibold tabular-nums text-foreground">
              {strategyContext.postsThisWeek}/{strategyContext.postsTarget}
            </span>{' '}
            posts this week
          </p>
          <p className="max-w-md truncate text-xs text-muted-foreground">
            {strategyContext.suggestion}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading your calendar…</p>
        </div>
      ) : (
        <div className="enhanced-calendar rounded-xl border border-border bg-card p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={view}
            events={events}
            editable={true}
            droppable={true}
            eventDrop={handleEventDrop}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            eventContent={renderEventContent}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
            height="auto"
            dayMaxEvents={4}
            eventDisplay="block"
            slotDuration="00:30:00"
            slotLabelInterval="01:00"
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
            nowIndicator={true}
            scrollTime="08:00:00"
            allDaySlot={false}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
          />
        </div>
      )}

      <PostPreviewModal
        post={selectedPost}
        brandName={brandName}
        onClose={() => setSelectedPost(null)}
        onEdit={(id) => {
          setSelectedPost(null)
          router.push(`/agency/social/compose?draft=${id}`)
        }}
      />

      <style jsx global>{`
        .enhanced-calendar .fc {
          --fc-border-color: var(--line);
          --fc-button-bg-color: var(--panel);
          --fc-button-border-color: var(--line);
          --fc-button-hover-bg-color: var(--panel-2);
          --fc-button-hover-border-color: var(--brand);
          --fc-button-active-bg-color: var(--brand-deep);
          --fc-button-active-border-color: var(--brand-deep);
          --fc-button-text-color: var(--ink);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: var(--panel-2);
          --fc-today-bg-color: var(--brand-wash);
          --fc-event-border-color: transparent;
          font-family: var(--font-sans), system-ui, sans-serif;
        }

        .enhanced-calendar .fc .fc-toolbar-title {
          font-size: 19px;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: var(--ink);
        }

        .enhanced-calendar .fc .fc-col-header-cell-cushion,
        .enhanced-calendar .fc .fc-daygrid-day-number {
          color: var(--ink-2);
          font-size: 12.5px;
          font-weight: 600;
        }

        .enhanced-calendar .fc .fc-event {
          border-radius: 6px;
          padding: 0;
          font-size: 12px;
          cursor: pointer;
          border-width: 0;
          background: transparent;
        }

        .enhanced-calendar .fc .fc-button {
          border-radius: 8px;
          font-size: 12.5px;
          font-weight: 600;
          padding: 7px 12px;
        }

        .enhanced-calendar .fc .fc-button-active {
          color: var(--brand-ink);
        }

        .enhanced-calendar .fc .fc-daygrid-more-link {
          color: var(--brand-deep);
          font-size: 12px;
          font-weight: 600;
        }

        .enhanced-calendar .fc .fc-timegrid-slot {
          border-color: var(--line-soft);
          height: 2.5rem;
        }

        .enhanced-calendar .fc .fc-timegrid-slot-label {
          font-size: 11px;
          color: var(--ink-3);
          font-variant-numeric: tabular-nums;
          vertical-align: top;
          padding-top: 4px;
        }

        .enhanced-calendar .fc .fc-timegrid-col {
          border-color: var(--line-soft);
        }

        .enhanced-calendar .fc .fc-timegrid-now-indicator-line {
          border-color: var(--brand);
          border-width: 2px;
        }

        .enhanced-calendar .fc .fc-timegrid-now-indicator-arrow {
          border-color: var(--brand);
        }

        .enhanced-calendar .fc .fc-col-header-cell {
          padding: 8px 4px;
          border-bottom: 1px solid var(--line);
          background: var(--panel-2);
        }

        .enhanced-calendar .fc .fc-col-header-cell.fc-day-today {
          background: var(--brand-wash);
        }

        .enhanced-calendar .fc .fc-col-header-cell-cushion {
          font-weight: 600;
          letter-spacing: 0.01em;
        }

        .enhanced-calendar .fc .fc-timegrid-slot-lane {
          cursor: pointer;
        }

        .enhanced-calendar .fc .fc-timegrid-slot-lane:hover {
          background: var(--brand-wash);
        }

        .enhanced-calendar .fc .fc-daygrid-day:not(.fc-day-disabled) {
          cursor: pointer;
        }

        .enhanced-calendar .fc .fc-daygrid-day:not(.fc-day-disabled):hover {
          background: var(--brand-wash);
        }
      `}</style>
    </div>
  )
}
