'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { Scale } from 'lucide-react'

import { DepartmentTabs, departmentPanelId, departmentTabId } from '@/components/agency/shell/DepartmentTabs'
import type { DepartmentTab } from '@/components/agency/shell/DepartmentTabs'
import {
  loadNavCounts,
  SOCIAL_TABS,
  socialTabIdFromPath,
  type SocialTabCountId,
  type SocialTabId,
} from '@/components/agency/shell/nav-sections'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'

/**
 * The Social department's chrome: header, inner tab strip, the one scrolling
 * pane, and the pinned action bar underneath it.
 *
 * ── The measurements are the contract, not a preference ────────────────
 * `.mockups/dept-social.html` and DESIGN.md agree: header `20px 26px 0`, tab
 * strip nested INSIDE the header at `margin-top: 14px` so its hairline is inset
 * by the header's own 26px, pane `18px 26px 26px` and nothing else scrolling,
 * action bar a `flex-shrink: 0` sibling pinned last. This file previously used
 * 24/12 with the pane not scrolling at all, which is why every child screen had
 * to grow its own scroller and its own padding — and why no two of them agreed
 * on either. Children get a padded, scrolling pane now; they should not add a
 * second one inside it.
 *
 * ── The action bar belongs to the DEPARTMENT ───────────────────────────
 * It used to live inside `PostCreator`, which meant the one control the owner
 * reaches for — "has this gone out yet, and how do I send it" — was the private
 * property of a single child screen. Anything else that needs to pin a decision
 * (a bulk action on Posts, an approve on the queue) had to invent its own. The
 * slot is rendered here and filled by whichever screen is showing, through
 * `<SocialActionBar>`. It is a DOM portal rather than a context value on
 * purpose: pushing React children up through a provider means new element
 * identity on every parent render, and a state setter fed by that loops.
 *
 * ── "Waiting on you" is not a tab badge ────────────────────────────────
 * The tab strip carries QUIET inventory counts — how much is in there. The
 * queue is an attention badge and it lives in the sidebar, where the owner can
 * see it from any screen in the product rather than only from inside this one.
 *
 * ── A badge must equal the screen it opens ─────────────────────────────
 * Whatever number this strip puts on a tab is a promise about what the owner
 * will find when he clicks it. "Posts 121" opened a list of 70, because the
 * badge counted every `scheduled_posts` row and the list quite rightly hides
 * the bin. The counts come from `/api/social/nav-counts`, which now derives
 * them with the same functions the list uses (`@/lib/posts/desk-status`), so
 * the two cannot drift apart again without a test going red.
 */

/** Marks the pinned slot in the DOM so a child can portal into it. */
export const SOCIAL_ACTION_BAR_ATTR = 'data-social-action-bar'

/**
 * Fill the department's pinned action bar from whatever screen is showing.
 *
 * Renders nothing where it is written. Mount it once per screen; the slot
 * collapses to nothing while no screen is filling it, so a department without a
 * decision to offer does not grow an empty bordered strip.
 */
export function SocialActionBar({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setHost(document.querySelector<HTMLElement>(`[${SOCIAL_ACTION_BAR_ATTR}]`))
  }, [])

  return host ? createPortal(children, host) : null
}

/* ── Header copy ─────────────────────────────────────────────────────────── */

/**
 * From the mockup, verbatim. It is deliberately not interpolated with the
 * business name: the sidebar already says which business this is, twice, and a
 * third "Posting desk for Downscale Weight Loss" is chrome describing chrome
 * rather than telling the owner what this screen does.
 */
const DEPARTMENT_TITLE = 'Social media'
const DEPARTMENT_SUBTITLE =
  'Everything you post, in one place. Write it, see it, decide when it goes.'

/* ── Inner implementation ────────────────────────────────────────────────── */

function SocialDepartmentChromeInner({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() ?? '/agency/social'
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const studioData = useStudioData(activeBrandId)

  const activeTab = socialTabIdFromPath(pathname)

  const isHealthBrand = Boolean(
    studioData.brand?.compliance_flags?.ahpra || studioData.brand?.compliance_flags?.tga,
  )

  /**
   * Quiet inventory counts. Absent until they are known, and absent for ever if
   * they cannot be read — a tab that says "0 templates" when nobody looked is
   * worse than a tab that says nothing.
   *
   * `posts` is the count the list's own "All" tab shows: everything except the
   * bin. It is derived server-side from the shared desk-status functions rather
   * than recomputed here, so there is one answer, not two that look alike.
   */
  const [tabCounts, setTabCounts] = useState<Partial<Record<SocialTabCountId, number>>>({})

  useEffect(() => {
    if (!activeBrandId) return
    let cancelled = false
    void loadNavCounts(activeBrandId).then((payload) => {
      if (cancelled || !payload) return
      setTabCounts(payload.tabCounts)
    })
    return () => {
      cancelled = true
    }
  }, [activeBrandId])

  const tabs: DepartmentTab[] = SOCIAL_TABS.map((tab) => {
    const Icon = tab.icon
    const count = tab.countId ? tabCounts[tab.countId] : undefined
    return {
      id: tab.id,
      label: tab.label,
      icon: <Icon className="size-4" strokeWidth={1.9} aria-hidden />,
      // Never badge 0: an empty library is not news, and a 0 from an
      // unmeasured count is a claim we did not earn.
      ...(typeof count === 'number' && count > 0 ? { count } : {}),
    }
  })

  const handleTabChange = useCallback(
    (id: string) => {
      const tab = SOCIAL_TABS.find((candidate) => candidate.id === (id as SocialTabId))
      if (tab) router.push(tab.href)
    },
    [router],
  )

  /**
   * A Social route that is not a tab — Social accounts, Posting schedule — is a
   * real place with no tab of its own. The panel then names ITSELF rather than
   * pointing `aria-labelledby` at a tab button that is not in the document,
   * which is what it used to do and what left the panel nameless.
   */
  const panelLabelling = activeTab
    ? {
        id: departmentPanelId('social', activeTab),
        role: 'tabpanel' as const,
        'aria-labelledby': departmentTabId('social', activeTab),
      }
    : {
        role: 'region' as const,
        'aria-label': 'Social media',
      }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Department header — 20px 26px 0, with the tab strip nested inside it
          so the strip's hairline is inset by the same 26px. */}
      <header className="shrink-0 px-[26px] pt-[20px] pb-0">
        <div className="flex items-end gap-4">
          <div className="min-w-0">
            <h1
              className="text-[19px] font-semibold tracking-tight"
              style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}
            >
              {DEPARTMENT_TITLE}
            </h1>
            <p
              className="mt-0.5 text-[13px]"
              style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
            >
              {DEPARTMENT_SUBTITLE}
            </p>
          </div>
          {isHealthBrand ? (
            <span
              className="ml-auto mb-1 flex shrink-0 items-center gap-1.5 rounded-lg px-[9px] py-[5px] text-[11.5px] font-semibold"
              style={{
                color: 'var(--care, oklch(0.52 0.150 25))',
                background: 'var(--care-wash, oklch(0.965 0.028 25))',
              }}
            >
              <Scale className="size-3.5" strokeWidth={2} aria-hidden />
              Health rules on — every post is checked first
            </span>
          ) : null}
        </div>

        <DepartmentTabs
          group="social"
          tabs={tabs}
          value={activeTab ?? ''}
          onValueChange={handleTabChange}
          label="Social media sections"
          className="mt-[14px]"
        />
      </header>

      {/* THE pane. The only scroller in the department, 18px 26px 26px.
          `flex flex-col` so a screen that wants to fill the height can still
          claim it with flex-1; everything else simply scrolls. */}
      <div
        {...panelLabelling}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-[26px] pt-[18px] pb-[26px]"
      >
        {children}
      </div>

      {/* The pinned decision. Empty until a screen fills it — `empty:hidden`
          rather than a conditional render, so the slot is in the DOM before the
          screen that portals into it mounts. */}
      <div
        {...{ [SOCIAL_ACTION_BAR_ATTR]: '' }}
        className="shrink-0 border-t bg-[var(--panel,oklch(1_0_0))] empty:hidden"
        style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}
      />
    </div>
  )
}

/* ── Public export ───────────────────────────────────────────────────────── */

export function SocialDepartmentChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>}
    >
      <SocialDepartmentChromeInner>{children}</SocialDepartmentChromeInner>
    </Suspense>
  )
}
