'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Eye, PanelRightClose, X } from 'lucide-react'
import { SocialActionBar } from '@/components/agency/social/SocialDepartmentChrome'

/**
 * The composer is a SPLIT PANE, and that is a deliberate exception.
 *
 * ── The override, dated ────────────────────────────────────────────────────
 * DESIGN.md locks a single work column for every department screen, and this
 * file used to enforce it here too. On **19 August 2026** the owner overrode
 * that for the composer specifically — "UI OF MIXPOST THATS WHAT I WANT AND
 * DEMAND" — after weeks of asking. Mixpost's `Pages/Posts/CreateEdit.vue` is a
 * form on the left and a fixed 750px pane on the right carrying two tabs,
 * Preview and Activity, and that is the shape he chose over the single-column
 * mockup with the preview buried under the caption.
 *
 * This is recorded here, and as one line in DESIGN.md under Layout, so nobody
 * reads the single-column rule, finds this file breaking it, and helpfully
 * "fixes" it back. It is the ONE documented exception. Everything else in the
 * department is still one column.
 *
 * ── Why the right pane is not simply a third column in the grid ────────────
 * The Social shell owns the only scroller in the department. A pane that
 * scrolled the page would drag the form's scroll position with it, so the
 * split lives INSIDE that pane: two columns, each scrolling itself, and the
 * shell's scroller never has anything to do. That is also what makes the phone
 * frame stay put while the form runs past it, which is the entire point of
 * having it beside the form rather than under it.
 *
 * ── Phone ─────────────────────────────────────────────────────────────────
 * This runs as a PWA on a phone, where 750px beside a form is not a layout, it
 * is a joke. Below 1280px the pane leaves the flow entirely, the form takes the
 * full width, and the preview opens as a sheet over the top from one button.
 * The open/closed choice is remembered, so an owner who works with it shut is
 * not reopening it every time he comes back.
 */

interface ComposerLayoutProps {
  editor: ReactNode
  /** The Preview tab's contents — the phone frame for the chosen account. */
  preview?: ReactNode
  /** The Activity tab's contents — this post's history and its notes. */
  activity?: ReactNode
  actionBar: ReactNode
  /**
   * Who owns the frame around the composer.
   *
   * `department` — the Social shell supplies the padded pane and a pinned slot
   * for the decision. Drawing a second scrolling, 26px-padded column inside it
   * gave the composer two scrollbars and 52px down each side, and left the
   * department's action-bar slot empty while the composer pinned its own
   * Save/Schedule strip halfway up the page. So the split is handed straight to
   * the shell's pane and the bar is portalled into the slot, where every other
   * Social screen puts its decision.
   *
   * `standalone` — `/agency/studio/create`, which has no department shell
   * around it. It still needs its own scroller and its own pinned foot.
   */
  chrome?: 'department' | 'standalone'
}

type SidePaneTab = 'preview' | 'activity'

/** Mixpost's own number. Below this the pane cannot sit beside the form. */
const SIDE_PANE_WIDTH = 750

/**
 * The form needs roughly 560px to stay usable next to a 750px pane, plus the
 * sidebar and the Director rail. Under that the pane becomes a sheet.
 */
const SPLIT_QUERY = '(min-width: 1280px)'

const OPEN_KEY = 'nrs.composer.side-pane.open'
const TAB_KEY = 'nrs.composer.side-pane.tab'

/**
 * Whether the viewport is wide enough for a real split.
 *
 * Starts `false` on purpose: the server has no viewport, so rendering the
 * narrow layout first and widening after mount is the only version of this that
 * does not hydrate into a mismatch.
 */
function useIsSplitWidth(): boolean {
  const [wide, setWide] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia(SPLIT_QUERY)
    const apply = () => setWide(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return wide
}

/** Remembered choices. A failed read is not a reason to lose the screen. */
function readStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.localStorage.getItem(key)
    return stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback
  } catch {
    return fallback
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* private mode, or storage full — the layout still works, it just forgets */
  }
}

export function ComposerLayout({
  editor,
  preview,
  activity,
  actionBar,
  chrome = 'standalone',
}: ComposerLayoutProps) {
  const wide = useIsSplitWidth()
  const hasSidePane = Boolean(preview || activity)

  // Desktop default is open. Read after mount so the server and the first
  // client render agree.
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState<SidePaneTab>('preview')

  useEffect(() => {
    setOpen(readStored(OPEN_KEY, 'open', ['open', 'closed'] as const) === 'open')
    setTab(readStored(TAB_KEY, 'preview', ['preview', 'activity'] as const))
  }, [])

  const toggleOpen = useCallback(() => {
    setOpen((current) => {
      const next = !current
      writeStored(OPEN_KEY, next ? 'open' : 'closed')
      return next
    })
  }, [])

  const chooseTab = useCallback((next: SidePaneTab) => {
    setTab(next)
    writeStored(TAB_KEY, next)
  }, [])

  // Escape closes the sheet. Only bound while it is up, so it cannot steal the
  // key from a dialog inside the form.
  const sheetShowing = hasSidePane && open && !wide
  useEffect(() => {
    if (!sheetShowing) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') toggleOpen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetShowing, toggleOpen])

  const paneBody = (
    <SidePaneBody tab={tab} onTabChange={chooseTab} preview={preview} activity={activity} />
  )

  const toggle = hasSidePane ? (
    <button
      type="button"
      onClick={toggleOpen}
      aria-expanded={open}
      className="flex shrink-0 items-center gap-[7px] rounded-[8px] border px-[12px] py-[7px] text-[12.5px] font-semibold transition-colors duration-150"
      style={{
        borderColor: open && wide ? 'var(--brand, oklch(0.52 0.09 55))' : 'var(--line, oklch(0.915 0.007 240))',
        background: open && wide ? 'var(--brand-wash, oklch(0.966 0.03 55))' : 'var(--panel, oklch(1 0 0))',
        color: open && wide ? 'var(--brand-deep, oklch(0.33 0.07 55))' : 'var(--ink-2, oklch(0.46 0.012 240))',
      }}
    >
      {open && wide ? (
        <PanelRightClose className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden />
      ) : (
        <Eye className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden />
      )}
      {wide ? (open ? 'Hide preview' : 'Show preview') : 'Preview'}
    </button>
  ) : null

  const split = (
    <div className="flex min-h-0 flex-1 gap-[18px]">
      {/* The form. Its own scroller so the pane beside it stays put. */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {toggle && <div className="mb-[12px] flex justify-end">{toggle}</div>}
        {editor}
      </div>

      {hasSidePane && wide && open && (
        <aside
          className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-[12px] border"
          style={{
            width: SIDE_PANE_WIDTH,
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            boxShadow:
              '0 1px 2px oklch(0.2 0.02 240/.05), 0 8px 24px -16px oklch(0.2 0.02 240/.28)',
          }}
          aria-label="Preview and activity"
        >
          {paneBody}
        </aside>
      )}
    </div>
  )

  const sheet = sheetShowing ? (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Preview and activity">
      <button
        type="button"
        aria-label="Close preview"
        onClick={toggleOpen}
        className="absolute inset-0 h-full w-full cursor-default"
        style={{ background: 'oklch(0.20 0.014 240 / 0.34)' }}
      />
      <div
        className="relative flex h-full w-full max-w-[750px] flex-col overflow-hidden border-l"
        style={{
          borderColor: 'var(--line, oklch(0.915 0.007 240))',
          background: 'var(--panel, oklch(1 0 0))',
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between border-b px-[15px] py-[11px]"
          style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}
        >
          <span className="text-[12.5px] font-semibold" style={{ color: 'var(--ink, oklch(0.20 0.014 240))' }}>
            How it will look
          </span>
          <button
            type="button"
            onClick={toggleOpen}
            aria-label="Close preview"
            className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border"
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel-2, oklch(0.975 0.004 240))',
              color: 'var(--ink-2, oklch(0.46 0.012 240))',
            }}
          >
            <X className="h-[14px] w-[14px]" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {paneBody}
      </div>
    </div>
  ) : null

  if (chrome === 'department') {
    return (
      <>
        {split}
        <SocialActionBar>{actionBar}</SocialActionBar>
        {sheet}
      </>
    )
  }

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--bg, oklch(0.985 0.002 240))' }}>
      <div className="flex min-h-0 flex-1 px-[26px] py-[18px]">{split}</div>

      <div
        className="shrink-0 border-t"
        style={{
          borderColor: 'var(--line, oklch(0.915 0.007 240))',
          background: 'var(--panel, oklch(1 0 0))',
        }}
      >
        {actionBar}
      </div>

      {sheet}
    </div>
  )
}

/**
 * Preview | Activity. Two tabs, exactly as Mixpost has them, and in that order:
 * what it will look like is what the owner is here for; what has happened to it
 * is what he comes back for.
 */
function SidePaneBody({
  tab,
  onTabChange,
  preview,
  activity,
}: {
  tab: SidePaneTab
  onTabChange: (next: SidePaneTab) => void
  preview?: ReactNode
  activity?: ReactNode
}) {
  const tabs: Array<{ id: SidePaneTab; label: string; body: ReactNode }> = [
    { id: 'preview', label: 'Preview', body: preview },
    { id: 'activity', label: 'Activity', body: activity },
  ]
  const available = tabs.filter((entry) => entry.body)
  const active = available.find((entry) => entry.id === tab) ?? available[0]

  return (
    <>
      <div
        className="flex shrink-0 gap-[2px] border-b px-[15px]"
        style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}
        role="tablist"
        aria-label="Preview and activity"
      >
        {available.map((entry) => {
          const on = entry.id === active?.id
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onTabChange(entry.id)}
              className="-mb-px border-b-2 px-[12px] pb-[10px] pt-[9px] text-[13.5px] transition-colors duration-150"
              style={{
                borderBottomColor: on ? 'var(--brand, oklch(0.52 0.09 55))' : 'transparent',
                color: on ? 'var(--brand-deep, oklch(0.33 0.07 55))' : 'var(--ink-2, oklch(0.46 0.012 240))',
                fontWeight: on ? 600 : 400,
              }}
            >
              {entry.label}
            </button>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{active?.body}</div>
    </>
  )
}
