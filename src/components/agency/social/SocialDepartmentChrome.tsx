'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { DepartmentTabs, departmentPanelId } from '@/components/agency/shell/DepartmentTabs'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { WAITING_ON_YOU_FILTER } from '@/components/agency/shell/nav-sections'
import type { DepartmentTab } from '@/components/agency/shell/DepartmentTabs'

/**
 * Social media department chrome — department header + inner tab strip that
 * wraps every Social sub-page. Routing is real (Next.js router.push), not
 * in-memory, so deep links and back-navigation work correctly.
 *
 * Compose stays full-height (the panel div uses `overflow-hidden flex flex-col`
 * rather than `overflow-y-auto`) so PostCreator is never clipped by a parent
 * scroller.
 *
 * "Waiting on you" count: only shown when > 0, never 0-badged.
 */

type SocialTabId =
  | 'compose'
  | 'posts'
  | 'waiting'
  | 'calendar'
  | 'media'
  | 'templates'
  | 'schedule'
  | 'analytics'
  | 'accounts'

function tabIdFromPath(pathname: string, searchParams: URLSearchParams): SocialTabId {
  if (
    pathname.includes('/social/posts') &&
    searchParams.get(WAITING_ON_YOU_FILTER.param) === WAITING_ON_YOU_FILTER.value
  ) {
    return 'waiting'
  }
  const slug = pathname.split('/').filter(Boolean).at(-1) ?? ''
  const map: Record<string, SocialTabId> = {
    social: 'compose',
    compose: 'compose',
    posts: 'posts',
    calendar: 'calendar',
    media: 'media',
    templates: 'templates',
    schedule: 'schedule',
    analytics: 'analytics',
    // Setup → Social accounts is a sidebar destination, not an inner tab.
    // Do not light Analytics (or Compose) while the owner is here.
    accounts: 'accounts',
  }
  return map[slug] ?? 'compose'
}

function tabHref(id: SocialTabId): string {
  const waitingHref = `/agency/social/posts?${WAITING_ON_YOU_FILTER.param}=${WAITING_ON_YOU_FILTER.value}`
  const map: Record<SocialTabId, string> = {
    compose: '/agency/social',
    posts: '/agency/social/posts',
    waiting: waitingHref,
    calendar: '/agency/social/calendar',
    media: '/agency/social/media',
    templates: '/agency/social/templates',
    schedule: '/agency/social/schedule',
    analytics: '/agency/social/analytics',
    accounts: '/agency/social/accounts',
  }
  return map[id]
}

/* ── Inner (searchParams-aware) implementation ──────────────────────────── */

function SocialDepartmentChromeInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? '/agency/social'
  const searchParams = useSearchParams()
  const { activeBrandId } = useAgencyStore()
  const studioData = useStudioData(activeBrandId)

  const activeTab = tabIdFromPath(pathname, searchParams)

  const isHealthBrand = !!(
    studioData.brand?.compliance_flags?.ahpra ||
    studioData.brand?.compliance_flags?.tga
  )

  // "Waiting on you" count — pending items in the approval queue.
  // Never badge 0; if we can't fetch a real count we just don't show one.
  const [waitingCount, setWaitingCount] = useState<number | undefined>(undefined)
  const fetchedForBrand = useRef<string | null>(null)

  useEffect(() => {
    if (!activeBrandId || fetchedForBrand.current === activeBrandId) return
    fetchedForBrand.current = activeBrandId
    void fetch('/api/approvals?status=pending')
      .then((r) => (r.ok ? r.json() : []))
      .then((items: unknown) => {
        const count = Array.isArray(items) ? items.length : 0
        setWaitingCount(count > 0 ? count : undefined)
      })
      .catch(() => setWaitingCount(undefined))
  }, [activeBrandId])

  const tabs: DepartmentTab[] = [
    { id: 'compose', label: 'Compose' },
    { id: 'posts', label: 'Posts' },
    {
      id: 'waiting',
      label: 'Waiting on you',
      count: waitingCount,
      care: isHealthBrand && waitingCount !== undefined,
    },
    { id: 'calendar', label: 'Calendar' },
    { id: 'media', label: 'Media library' },
    { id: 'templates', label: 'Templates' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'analytics', label: 'Analytics' },
  ]

  const handleTabChange = useCallback(
    (id: string) => {
      router.push(tabHref(id as SocialTabId))
    },
    [router],
  )

  const description = studioData.loading
    ? 'Loading…'
    : studioData.brand?.name
      ? `Posting desk for ${studioData.brand.name}`
      : 'Your posting desk'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Department header */}
      <header className="shrink-0 px-6 pt-5 pb-0">
        <div className="flex items-end gap-4">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight">Social media</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
          </div>
          {isHealthBrand ? (
            <span
              className="ml-auto mb-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold"
              style={{
                color: 'var(--care, oklch(0.52 0.150 25))',
                background: 'var(--care-wash, oklch(0.965 0.028 25))',
              }}
            >
              AHPRA applies
            </span>
          ) : null}
        </div>
      </header>

      {/* Inner tab strip */}
      <div className="shrink-0 px-6 pt-3">
        <DepartmentTabs
          group="social"
          tabs={tabs}
          value={activeTab}
          onValueChange={handleTabChange}
          label="Social media sections"
        />
      </div>

      {/* Tab panel — children own their own scroll (PostsIndex, Calendar, etc.
          all wrap themselves in overflow-y-auto; ComposeScreen uses h-full).
          This container just gives the remaining height and clips the overflow
          at this boundary so nothing bleeds past the layout edge. */}
      <div
        id={departmentPanelId('social', activeTab)}
        role="tabpanel"
        aria-labelledby={`social-tab-${activeTab}`}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {children}
      </div>
    </div>
  )
}

/* ── Public export — wraps inner in Suspense for useSearchParams ─────────── */

export function SocialDepartmentChrome({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      }
    >
      <SocialDepartmentChromeInner>{children}</SocialDepartmentChromeInner>
    </Suspense>
  )
}
