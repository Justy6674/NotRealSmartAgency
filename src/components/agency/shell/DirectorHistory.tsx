'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, MessageSquare, Search, SquarePen } from 'lucide-react'
import { AGENT_LABELS } from '@/types/database'
import type { AgentType } from '@/types/database'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   PREVIOUS CHATS, inside the Director rail.

   The assistants the owner actually uses — Claude, ChatGPT, the Supabase
   assistant — all put history behind ONE control next to the conversation,
   not in the app's navigation. That is the shape here: the sidebar carries the
   businesses and the work; the rail carries the talking, and everything that
   has ever been said lives with the talking.

   Two things in this file are deliberately not new work:

   · The date grouping is a copy of ProjectSidebar.tsx:29-56, boundaries and
     labels identical, because the owner already reads "Today / Yesterday /
     This Week / Older" in that sidebar every day. A second, cleverer grouping
     would be a second thing to learn. It is copied rather than imported
     because it is a private helper of a component that is on its way out; when
     ProjectSidebar goes, this is where the grouping lives.

   · This panel does NOT fetch. It is handed a list and hands back a click.
     The conversations come from `GET /api/conversations?brandId=<uuid>` — the
     one history store this app has — and resuming one is the container's job.
     There is deliberately no second store, no cache, and no writes in here.
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * A row in the list. Snake_case on purpose: this is exactly the shape
 * `/api/conversations` returns, so a container passes its rows straight
 * through and the full `Conversation` type from `@/types/database` satisfies
 * it structurally without a mapping step nobody would keep in sync.
 */
export interface DirectorConversation {
  id: string
  title: string | null
  updated_at: string
  /** Which department the thread ran through. Absent is fine — it is only
   *  ever used to add a quiet plain-English label to a non-Director thread. */
  agent_type?: AgentType
}

type GroupLabel = 'Today' | 'Yesterday' | 'This Week' | 'Older'

/**
 * Verbatim port of ProjectSidebar.tsx:29-56, including the boundary rules:
 * anything at or after midnight today is Today, anything back to midnight
 * yesterday is Yesterday, anything inside seven days is This Week. Empty
 * groups are dropped so a quiet week does not render four headings and no
 * chats.
 *
 * `now` is injectable so this can be reasoned about (and tested) without
 * waiting for midnight; every caller in the app uses the default.
 */
export function groupConversationsByDate(
  conversations: DirectorConversation[],
  now: Date = new Date(),
): { label: GroupLabel; items: DirectorConversation[] }[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: GroupLabel; items: DirectorConversation[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This Week', items: [] },
    { label: 'Older', items: [] },
  ]

  for (const conv of conversations) {
    const date = new Date(conv.updated_at)
    if (date >= today) {
      groups[0].items.push(conv)
    } else if (date >= yesterday) {
      groups[1].items.push(conv)
    } else if (date >= weekAgo) {
      groups[2].items.push(conv)
    } else {
      groups[3].items.push(conv)
    }
  }

  return groups.filter((g) => g.items.length > 0)
}

/**
 * The group heading already says which day it was, so the row only has to say
 * which part of it. Fixed `en-AU` rather than the visitor's locale: the group
 * headings are written in Australian English and a row reading "3/12/25"
 * underneath "Older" is a different product speaking.
 */
function whenLabel(iso: string, group: GroupLabel, now: Date): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''

  if (group === 'Today' || group === 'Yesterday') {
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  }
  if (group === 'This Week') {
    return date.toLocaleDateString('en-AU', { weekday: 'long' })
  }
  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}

/** Same brand tint the rail uses for an active tab, read with a fallback. */
const BRAND_ACTIVE_ROW = {
  backgroundColor: 'var(--brand-wash, var(--accent))',
  color: 'var(--brand-deep, var(--foreground))',
} as const

/** Below this the field is clutter; above it, scanning by eye stops working. */
const SEARCH_APPEARS_AT = 6

export interface DirectorHistoryProps {
  /** Newest first. `/api/conversations` already returns them that way. */
  conversations: DirectorConversation[]
  /** Highlights the thread on screen. `useAgencyStore.activeConversationId`. */
  activeConversationId?: string | null
  /** True only while the FIRST load is in flight — see the note on `hasList`. */
  isLoading?: boolean
  /** The load failed. Say so plainly; never render what the failure said. */
  loadFailed?: boolean
  /** Plain business name, for the empty state. Never a slug. */
  brandName?: string | null
  /**
   * The whole row is handed back, not just the id, because resuming needs the
   * department too: `selectConversation(id, agent_type)` sets both, and the
   * store's `setAgent`/`setBrand` reset the open conversation if they are
   * called in the wrong order.
   */
  onSelect: (conversation: DirectorConversation) => void
  /** Start a fresh thread from in here. Omitted, the control is not drawn. */
  onNew?: () => void
  /** Back to the conversation. Always present — this is a drawer, not a page. */
  onClose: () => void
  className?: string
}

export function DirectorHistory({
  conversations,
  activeConversationId = null,
  isLoading = false,
  loadFailed = false,
  brandName,
  onSelect,
  onNew,
  onClose,
  className,
}: DirectorHistoryProps) {
  const [query, setQuery] = useState('')

  const trimmed = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!trimmed) return conversations
    return conversations.filter((c) => (c.title ?? '').toLowerCase().includes(trimmed))
  }, [conversations, trimmed])

  // One `now` for the whole render, so a chat cannot be grouped against one
  // clock and time-stamped against another as midnight rolls over mid-paint.
  const now = useMemo(() => new Date(), [])
  const groups = useMemo(() => groupConversationsByDate(filtered, now), [filtered, now])

  const showSearch = conversations.length >= SEARCH_APPEARS_AT

  return (
    <section
      aria-label="Previous chats"
      className={cn('flex min-h-0 flex-1 flex-col', className)}
    >
      {/* ── Header. The way back is the first thing in it. ─────────────────── */}
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to the conversation"
          title="Back to the conversation"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
          Previous chats
        </p>
        {onNew && (
          <button
            type="button"
            onClick={onNew}
            className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <SquarePen className="h-3.5 w-3.5" />
            New chat
          </button>
        )}
      </div>

      {showSearch && (
        <div className="shrink-0 border-b px-3 py-2">
          <label className="flex items-center gap-2 rounded-lg border bg-muted/40 px-2 py-1.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="sr-only">Search your previous chats</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your chats"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      )}

      {/* ── The list ───────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {/* "Still loading" and "genuinely none" must never look the same. A
            first-time owner being told they have no history is fine; an owner
            with sixty chats being told it for half a second is the interface
            lying on every single open. */}
        {isLoading && conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Looking for your earlier chats…
          </p>
        ) : loadFailed && conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Your earlier chats could not be loaded just now. Nothing has been lost — have
            another go in a moment.
          </p>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {brandName
              ? `No earlier chats about ${brandName} yet. This one is the first.`
              : 'No earlier chats yet. This one is the first.'}
          </p>
        ) : groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Nothing matches “{query.trim()}”.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {groups.map(({ label, items }) => (
              <div key={label}>
                <p className="mb-0.5 px-2 text-[10px] font-medium tracking-wider text-muted-foreground/60 uppercase">
                  {label}
                </p>
                <ul className="flex flex-col">
                  {items.map((conv) => {
                    const active = conv.id === activeConversationId
                    const title = conv.title?.trim() || 'Untitled chat'
                    const when = whenLabel(conv.updated_at, label, now)
                    // The Director is the only face, so its own threads are not
                    // labelled — saying "NRS Director" on every row tells the
                    // owner nothing. A thread that ran somewhere else gets its
                    // plain-English name, which is what the sidebar shows today.
                    const through =
                      conv.agent_type && conv.agent_type !== 'overall'
                        ? AGENT_LABELS[conv.agent_type]
                        : null

                    return (
                      <li key={conv.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(conv)}
                          aria-current={active ? 'true' : undefined}
                          style={active ? BRAND_ACTIVE_ROW : undefined}
                          className={cn(
                            'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                            active ? 'font-medium' : 'hover:bg-muted',
                          )}
                        >
                          <MessageSquare
                            className={cn(
                              'mt-0.5 h-3.5 w-3.5 shrink-0',
                              active ? 'opacity-70' : 'text-muted-foreground',
                            )}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] leading-tight" title={title}>
                              {title}
                            </span>
                            {(when || through) && (
                              <span
                                className={cn(
                                  'mt-0.5 block truncate text-[11px] leading-tight',
                                  active ? 'opacity-70' : 'text-muted-foreground',
                                )}
                              >
                                {[when, through].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
