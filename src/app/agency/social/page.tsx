'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Images,
  LayoutTemplate,
  PenLine,
  ShieldCheck,
  SquareStack,
  Sparkles,
} from 'lucide-react'
import { PostCreator } from '@/components/agency/studio/post/PostCreator'
import {
  DepartmentTabs,
  departmentPanelId,
  departmentTabId,
  type DepartmentTab,
} from '@/components/agency/shell/DepartmentTabs'
import { useAgencyStore } from '@/stores/agency-store'
import { sendToDirector } from '@/lib/chat-dispatch'
import { cn } from '@/lib/utils'
import type { Brand } from '@/types/database'

/**
 * SOCIAL MEDIA — the department.
 *
 * "Create post" is not a page. It is the front door of an area of the business
 * you stay inside: write it here, look at what is already written, see when it
 * goes out, keep the pictures, set the times. That is what the composer living
 * on its own route never gave us — you wrote a post and were then dropped back
 * out to look for everything else it related to.
 *
 * Compose is the landing tab, and it is the real composer, unchanged. The rest
 * of the strip is deliberately honest: those screens exist elsewhere in the app
 * today and have not been moved in here yet, so each one says so in plain words
 * rather than showing a plausible-looking table of nothing.
 */

const GROUP = 'social'

type TabId = 'compose' | 'posts' | 'calendar' | 'media' | 'templates' | 'schedule' | 'analytics'

const ICON = 'h-4 w-4'

/**
 * No counts are passed. Every tab except Compose is a placeholder, and a number
 * beside a tab that then shows nothing is worse than no number — it reads as
 * "12 posts are in here" when the tab cannot show one. Counts go on when the
 * tab behind them does.
 */
const TABS: (DepartmentTab & { id: TabId })[] = [
  { id: 'compose', label: 'Compose', icon: <PenLine className={ICON} /> },
  { id: 'posts', label: 'Posts', icon: <SquareStack className={ICON} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarDays className={ICON} /> },
  { id: 'media', label: 'Media library', icon: <Images className={ICON} /> },
  { id: 'templates', label: 'Templates', icon: <LayoutTemplate className={ICON} /> },
  { id: 'schedule', label: 'Schedule', icon: <Clock3 className={ICON} /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className={ICON} /> },
]

const TAB_IDS = TABS.map((tab) => tab.id)
const isTabId = (value: string | null): value is TabId =>
  value !== null && (TAB_IDS as string[]).includes(value)

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function SocialDepartmentPage() {
  const searchParams = useSearchParams()
  const { activeBrandId, pendingDraftId, pendingMediaId, setPendingDraftId, setPendingMediaId } =
    useAgencyStore()

  const requestedTab = searchParams.get('tab')
  const [tab, setTab] = useState<TabId>(() => (isTabId(requestedTab) ? requestedTab : 'compose'))
  const [brand, setBrand] = useState<Brand | null>(null)

  // Anything that links in here can name the tab it means — the calendar
  // sending you to the composer, a link that lands you on the media library.
  useEffect(() => {
    if (isTabId(requestedTab)) setTab(requestedTab)
  }, [requestedTab])

  // Only the compliance state is read here, and only to say out loud that the
  // health check is on. Everything else the composer needs it fetches itself.
  useEffect(() => {
    if (!activeBrandId) {
      setBrand(null)
      return
    }

    let cancelled = false
    fetch('/api/brands')
      .then((response) => (response.ok ? response.json() : []))
      .then((brands: Brand[]) => {
        if (cancelled) return
        setBrand(brands.find((candidate) => candidate.id === activeBrandId) ?? null)
      })
      .catch(() => {
        if (!cancelled) setBrand(null)
      })

    return () => {
      cancelled = true
    }
  }, [activeBrandId])

  const selectTab = (next: string) => {
    if (!isTabId(next)) return
    setTab(next)
    // Keep the address bar honest so the tab survives a reload and can be
    // shared, without a navigation that would tear down the composer and lose
    // whatever the owner had half-written in it.
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (next === 'compose') url.searchParams.delete('tab')
      else url.searchParams.set('tab', next)
      window.history.replaceState(null, '', url.toString())
    }
  }

  // The composer's existing entry points, preserved exactly. The sidebar's
  // "Create post", a click on an empty calendar slot, "edit this draft" from
  // the review screen and a restored Desk proposal all still land correctly.
  const draftParam = searchParams.get('draft')
  const mediaParam = searchParams.get('media')
  const conversationParam = searchParams.get('conversation')
  const outputParam = searchParams.get('output')
  const exactDraftId = draftParam && UUID_PATTERN.test(draftParam) ? draftParam : null
  const exactMediaId = mediaParam && UUID_PATTERN.test(mediaParam) ? mediaParam : null
  const deskConversationId =
    conversationParam && UUID_PATTERN.test(conversationParam) ? conversationParam : undefined
  const deskOutputId = outputParam && UUID_PATTERN.test(outputParam) ? outputParam : undefined

  const dateParam = searchParams.get('date')
  const timeParam = searchParams.get('time')
  const initialScheduleDate = dateParam ? `${dateParam}T${timeParam ?? '09:00'}` : undefined

  const handleDone = () => {
    setPendingDraftId(null)
    setPendingMediaId(null)
  }

  const compliance = brand?.compliance_flags
  const healthRulesOn = Boolean(compliance?.ahpra || compliance?.tga)

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Department header — fixed. Only the panel below it scrolls. */}
      <div className="shrink-0 px-5 pt-5 lg:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Social media</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Everything you post, in one place. Write it, see it, decide when it goes.
            </p>
          </div>

          {healthRulesOn ? (
            <span
              className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
              style={{
                color: 'var(--care, var(--destructive))',
                background: 'var(--care-wash, var(--muted))',
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Health rules on — every post is checked first
            </span>
          ) : null}
        </div>

        <DepartmentTabs
          group={GROUP}
          tabs={TABS}
          value={tab}
          onValueChange={selectTab}
          label="Social media sections"
          className="mt-3.5"
        />
      </div>

      {/*
        COMPOSE stays mounted when you look at another tab. It is the one tab
        holding unsaved words, and a half-written caption must survive a glance
        at the calendar — hiding it keeps the component alive, unmounting it
        would throw the work away.
      */}
      <section
        id={departmentPanelId(GROUP, 'compose')}
        role="tabpanel"
        aria-labelledby={departmentTabId(GROUP, 'compose')}
        className={cn('min-h-0 flex-1', tab === 'compose' ? 'flex flex-col' : 'hidden')}
      >
        <div className="h-full overflow-hidden">
          <PostCreator
            draftId={exactDraftId ?? pendingDraftId ?? undefined}
            mediaId={exactMediaId ?? pendingMediaId ?? undefined}
            deskConversationId={deskConversationId}
            deskOutputId={deskOutputId}
            onDone={handleDone}
            initialScheduleDate={initialScheduleDate}
          />
        </div>
      </section>

      {tab === 'posts' ? (
        <Placeholder
          tab="posts"
          icon={<SquareStack className="h-5 w-5" />}
          title="Posts"
          blurb="Everything you have written — still a draft, waiting to go out, or already published — with what happened to each one."
          ask="Show me the posts we have written for this business and what is happening with each of them."
        />
      ) : null}

      {tab === 'calendar' ? (
        <Placeholder
          tab="calendar"
          icon={<CalendarDays className="h-5 w-5" />}
          title="Calendar"
          blurb="A month and a week view of what goes out when, so you can see the gaps before they happen."
          ask="What is going out this week and where are the gaps?"
        />
      ) : null}

      {tab === 'media' ? (
        <Placeholder
          tab="media"
          icon={<Images className="h-5 w-5" />}
          title="Media library"
          blurb="Your photos and videos, ready to drop straight into a post."
          ask="What photos and videos do we have ready to use for this business?"
        />
      ) : null}

      {tab === 'templates' ? (
        <Placeholder
          tab="templates"
          icon={<LayoutTemplate className="h-5 w-5" />}
          title="Templates"
          blurb="Post shapes you reuse, so you are never starting from a blank page."
          ask="What post templates do we have, and which ones work best?"
        />
      ) : null}

      {tab === 'schedule' ? (
        <Placeholder
          tab="schedule"
          icon={<Clock3 className="h-5 w-5" />}
          title="Posting schedule"
          blurb="The days and times each account posts, set once so you are not picking a time on every post."
          ask="What times do we post on each account at the moment?"
        />
      ) : null}

      {tab === 'analytics' ? (
        <Placeholder
          tab="analytics"
          icon={<BarChart3 className="h-5 w-5" />}
          title="Analytics"
          blurb="What each post actually did — how many people saw it, and how many did something about it."
          ask="How did our posts perform over the last month?"
        />
      ) : null}
    </div>
  )
}

/**
 * An empty tab that tells the truth.
 *
 * It shows no rows, no totals and no sample content. A placeholder dressed up
 * with plausible numbers is how the owner ends up making a decision on data
 * that was never real, so this one is explicit that nothing has been loaded and
 * that the tab is not connected yet.
 */
function Placeholder({
  tab,
  icon,
  title,
  blurb,
  ask,
}: {
  tab: TabId
  icon: ReactNode
  title: string
  blurb: string
  ask: string
}) {
  return (
    <section
      id={departmentPanelId(GROUP, tab)}
      role="tabpanel"
      aria-labelledby={departmentTabId(GROUP, tab)}
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6 lg:px-6"
    >
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {icon}
        </span>

        <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{blurb}</p>

        <p className="mt-4 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Not connected here yet.</span> This tab is
          empty on purpose — nothing below it has been loaded, so nothing you see here is a real
          number about your business.
        </p>

        <button
          type="button"
          onClick={() => sendToDirector(ask)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask about this instead
        </button>
      </div>
    </section>
  )
}
