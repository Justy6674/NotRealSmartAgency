'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { UIMessage } from 'ai'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  ChevronRight,
  Eye,
  Inbox,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  X,
} from 'lucide-react'
import { AgentAvatar } from '@/components/agency/AgentAvatar'
import { ChatInput } from '@/components/agency/ChatInput'
import { ChatMessage } from '@/components/agency/ChatMessage'
import { sendToDirector } from '@/lib/chat-dispatch'
import { cn } from '@/lib/utils'

/* ═══════════════════════════════════════════════════════════════════════════
   THE DIRECTOR RAIL

   Two designs before this one put the AI in the centre of the screen and the
   work around the edges. That is backwards for someone who came here to write
   a post, and it was rejected twice. So the shape of this file encodes the
   law rather than trusting anyone to remember it:

     · The rail owns NO action of its own. Every control in here either sends
       text to the Director or runs a callback the owning screen already has a
       manual button for. There is deliberately no route in this file to
       publishing, saving, scheduling or connecting anything.
     · Every suggestion is dismissable, and dismissal works even when the
       caller forgets to pass `onDismissSuggestion` — the rail keeps its own
       dismissed set so the promise is structural, not a caller's good manners.
     · Collapsing it removes nothing. The collapse control is always visible
       and the collapsed state persists, so a person who never wants the AI
       gets a 52px strip forever and a whole screen to work in.

   It does not fetch. Messages, suggestions, proposals and notes arrive as
   props from whatever owns the conversation transport. That seam is marked
   below at `DirectorRailProps` — a container mounts this, owns `useChat`, and
   passes the results down. Until one exists the input still works, because it
   falls through to the app-wide `sendToDirector` bridge.
   ══════════════════════════════════════════════════════════════════════════ */

export type DirectorRailTab = 'director' | 'preview' | 'activity' | 'analytics'

/** A one-line thing the owner might want next. Never the only way to do it. */
export interface DirectorSuggestion {
  id: string
  label: string
  /** Optional glyph. Left quiet on purpose — these are offers, not buttons. */
  icon?: LucideIcon
  /**
   * What happens on click. Omit it and the label is spoken to the Director as
   * a message, which is the safe default: talking is never destructive.
   */
  onSelect?: () => void
  /** Send this text instead of the label when there is no `onSelect`. */
  prompt?: string
}

export interface DirectorProposalAction {
  id: string
  label: string
  onSelect: () => void
  /** `quiet` is the decline. Both are equally easy to reach, by design. */
  tone?: 'primary' | 'quiet'
}

/** An offer the Director is making. Always carries a dismiss control. */
export interface DirectorProposal {
  id: string
  title: string
  body?: string
  actions?: DirectorProposalAction[]
}

/**
 * A plain statement of fact about the current screen — what was checked, what
 * has and has not gone out. Not a suggestion, so it has no dismiss: a person
 * should not be able to make "nothing has gone out yet" disappear.
 */
export interface DirectorNote {
  id: string
  tone: 'ok' | 'warn' | 'care'
  title?: string
  body: string
}

export interface DirectorRailProps {
  /* ── The conversation seam ──────────────────────────────────────────────
     A container owns the transport and hands the results down. This
     component never calls fetch, never holds a conversation id, and never
     talks to Supabase. */
  messages?: UIMessage[]
  isLoading?: boolean
  onSend?: (text: string, images?: { data: string; mimeType: string }[]) => void
  /** Already made safe for reading aloud — never interpolate a raw error. */
  errorMessage?: string | null
  onDismissError?: () => void

  /* ── Everything the rail offers, all of it optional ─────────────────── */
  suggestions?: DirectorSuggestion[]
  onDismissSuggestion?: (id: string) => void
  proposals?: DirectorProposal[]
  onDismissProposal?: (id: string) => void
  notes?: DirectorNote[]

  /* ── Chrome ─────────────────────────────────────────────────────────── */
  /** Business name, for the input placeholder. Plain name, not a slug. */
  brandName?: string | null
  /** Footer middle phrase. Defaults to the plain "sees this screen". */
  contextLabel?: string
  departmentCount?: number

  /* ── The other three tabs are slots the screen fills, or honest blanks ── */
  previewSlot?: ReactNode
  activitySlot?: ReactNode
  analyticsSlot?: ReactNode
  defaultTab?: DirectorRailTab

  /* ── Collapse. Uncontrolled + persisted unless a parent takes over ───── */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  storageKey?: string

  className?: string
}

const TABS: { id: DirectorRailTab; label: string; icon: LucideIcon }[] = [
  { id: 'director', label: 'Director', icon: Sparkles },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'activity', label: 'Activity', icon: Inbox },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
]

/**
 * Note colours are written out rather than read from tokens because
 * `--ok` / `--warn` / `--care` do not exist in globals.css yet. The values
 * mirror .mockups/dept-social.html:31-34 (light) and :61-64 (dark). When the
 * tokens land, swap these three lines for them — do not colour-mix in oklch,
 * it interpolates through pink and has been rejected twice.
 */
const NOTE_TONE: Record<DirectorNote['tone'], string> = {
  ok: 'border-l-[oklch(0.55_0.13_155)] dark:border-l-[oklch(0.74_0.13_155)]',
  warn: 'border-l-[oklch(0.63_0.13_75)] dark:border-l-[oklch(0.80_0.13_78)]',
  care: 'border-l-[oklch(0.52_0.15_25)] dark:border-l-[oklch(0.77_0.13_25)]',
}

/* Brand tint comes from custom properties another part of the shell derives
   from the business's saved colours. They are read with a fallback so this
   file is correct before and after that lands, and inline rather than as a
   Tailwind arbitrary value so the fallback chain cannot be dropped by JIT. */
const BRAND_ACTIVE_TAB = {
  backgroundColor: 'var(--brand-wash, var(--accent))',
  color: 'var(--brand-deep, var(--foreground))',
} as const

export function DirectorRail({
  messages = [],
  isLoading = false,
  onSend,
  errorMessage = null,
  onDismissError,
  suggestions = [],
  onDismissSuggestion,
  proposals = [],
  onDismissProposal,
  notes = [],
  brandName,
  contextLabel = 'sees this screen',
  departmentCount = 14,
  previewSlot,
  activitySlot,
  analyticsSlot,
  defaultTab = 'director',
  collapsed: controlledCollapsed,
  onCollapsedChange,
  storageKey = 'nrs-director-rail',
  className,
}: DirectorRailProps) {
  const [tab, setTab] = useState<DirectorRailTab>(defaultTab)
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set())
  const conversationEndRef = useRef<HTMLDivElement>(null)

  const isControlled = controlledCollapsed !== undefined
  const collapsed = isControlled ? controlledCollapsed : uncontrolledCollapsed

  // Restore the collapsed preference AFTER mount. Reading localStorage during
  // render makes the server and the client disagree on the first paint, and
  // React throws away the whole mismatched subtree — which on a rail that is
  // supposed to be on every screen looks exactly like the rail being broken.
  // The cost is one frame of open-then-closed, which is the cheaper failure.
  useEffect(() => {
    if (isControlled) return
    try {
      setUncontrolledCollapsed(window.localStorage.getItem(storageKey) === 'collapsed')
    } catch {
      // Storage blocked (private browsing, locked-down browser). The rail
      // simply opens — never a reason to fail to render.
    }
  }, [isControlled, storageKey])

  const setCollapsed = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledCollapsed(next)
      onCollapsedChange?.(next)
      try {
        window.localStorage.setItem(storageKey, next ? 'collapsed' : 'open')
      } catch {
        // See above — a preference that cannot be saved is not an error.
      }
    },
    [isControlled, onCollapsedChange, storageKey],
  )

  const dismiss = useCallback((id: string, notify?: (id: string) => void) => {
    setDismissed((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    notify?.(id)
  }, [])

  const handleSend = useCallback(
    (text: string, images?: { data: string; mimeType: string }[]) => {
      if (onSend) {
        onSend(text, images)
        return
      }
      // No container wired to this rail yet. `sendToDirector` is the bridge
      // every "Ask the Director" button in the app already uses, so the input
      // is never a dead control. Attachments do not survive this path — the
      // bridge carries text only — which is why a real container should own
      // `onSend` in production.
      sendToDirector(text)
    },
    [onSend],
  )

  // Keep the end of the conversation in view without yanking the suggestions
  // below it off screen — `nearest` scrolls the minimum distance needed.
  useEffect(() => {
    if (tab !== 'director') return
    conversationEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [messages, tab])

  const visibleProposals = proposals.filter((p) => !dismissed.has(p.id))
  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.id))
  const placeholder = brandName ? `Ask NRS about ${brandName}…` : 'Ask NRS…'

  /* The desktop column and the mobile sheet are both in the DOM at once (one
     is hidden by a media query, not unmounted). Every id below is therefore
     scoped, or the tab/panel pairing would resolve to the wrong surface and
     duplicate ids would land in the accessibility tree. */

  /* ── Tab strip, with the collapse control always visible in it ────────── */
  const tabStrip = (scope: string, showHide: boolean) => (
    <div className="flex h-[50px] shrink-0 items-center gap-1 border-b px-2">
      {/* Four labelled tabs plus a labelled Hide button is a tight fit in
          380px. It measures under on the house font, but font stacks vary and
          a tab that wraps onto a second line would break the 50px strip — so
          the row scrolls instead of reflowing. */}
      <div
        role="tablist"
        aria-label="Director rail"
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:thin]"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`${scope}-tab-${id}`}
              aria-selected={active}
              aria-controls={`${scope}-panel-${id}`}
              onClick={() => setTab(id)}
              style={active ? BRAND_ACTIVE_TAB : undefined}
              className={cn(
                'flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1.5 text-xs whitespace-nowrap transition-colors',
                active
                  ? 'font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          )
        })}
      </div>
      {showHide && (
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-expanded
          aria-label="Hide the Director. Everything on this screen still works."
          title="Hide the Director — everything on this screen still works"
          className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
          Hide
        </button>
      )}
    </div>
  )

  /* ── Director tab: conversation → proposals → suggested → notes ───────── */
  const directorPanel = (scope: string) => (
    <div
      role="tabpanel"
      id={`${scope}-panel-director`}
      aria-labelledby={`${scope}-tab-director`}
      className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3"
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-2 pt-8 text-center">
          <AgentAvatar agentType="overall" size="lg" />
          <p className="text-sm font-medium text-foreground">Director</p>
          <p className="text-xs text-muted-foreground">
            Everything on this screen works without me. I am here if you want a hand.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3 py-4">
              <AgentAvatar agentType="overall" size="sm" />
              <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-2.5">
                <p className="text-sm text-muted-foreground">Thinking…</p>
              </div>
            </div>
          )}
        </div>
      )}
      <div ref={conversationEndRef} aria-hidden />

      {visibleProposals.map((proposal) => (
        <div key={proposal.id} className="rounded-xl border bg-muted/40 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">{proposal.title}</span>
              {proposal.body ? ` ${proposal.body}` : null}
            </p>
            <button
              type="button"
              onClick={() => dismiss(proposal.id, onDismissProposal)}
              aria-label={`Dismiss: ${proposal.title}`}
              title="Dismiss"
              className="-mr-1 shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {proposal.actions && proposal.actions.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {proposal.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={action.onSelect}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-xs transition-colors',
                    action.tone === 'quiet'
                      ? 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                      : 'bg-card text-foreground hover:bg-muted',
                  )}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {visibleSuggestions.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
            Suggested
          </p>
          <ul className="flex flex-col">
            {visibleSuggestions.map((suggestion) => {
              const Icon = suggestion.icon ?? ChevronRight
              return (
                <li key={suggestion.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      suggestion.onSelect
                        ? suggestion.onSelect()
                        : handleSend(suggestion.prompt ?? suggestion.label)
                    }
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1">{suggestion.label}</span>
                  </button>
                  {/* Always present, not only on hover: an offer you cannot
                      refuse is not an offer. Kept low-contrast so it reads as
                      available rather than as a second call to action. */}
                  <button
                    type="button"
                    onClick={() => dismiss(suggestion.id, onDismissSuggestion)}
                    aria-label={`Dismiss suggestion: ${suggestion.label}`}
                    title="Dismiss"
                    className="shrink-0 rounded p-1 text-muted-foreground/40 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {notes.map((note) => (
        <div
          key={note.id}
          className={cn(
            'rounded-lg border border-l-[3px] bg-muted/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground',
            NOTE_TONE[note.tone],
          )}
        >
          {note.title && <span className="font-semibold text-foreground">{note.title} </span>}
          {note.body}
        </div>
      ))}
    </div>
  )

  /** The other three tabs say plainly when a screen has given them nothing. */
  const slotPanel = (
    scope: string,
    id: Exclude<DirectorRailTab, 'director'>,
    slot: ReactNode,
    blank: string,
  ) => (
    <div
      role="tabpanel"
      id={`${scope}-panel-${id}`}
      aria-labelledby={`${scope}-tab-${id}`}
      className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
    >
      {slot ?? <p className="px-1 pt-6 text-center text-xs text-muted-foreground">{blank}</p>}
    </div>
  )

  const body = (scope: string) => (
    <>
      {tab === 'director' && directorPanel(scope)}
      {tab === 'preview' &&
        slotPanel(scope, 'preview', previewSlot, 'Nothing to preview from this screen yet.')}
      {tab === 'activity' &&
        slotPanel(scope, 'activity', activitySlot, 'Nothing has happened on this screen yet.')}
      {tab === 'analytics' &&
        slotPanel(scope, 'analytics', analyticsSlot, 'No numbers for this screen yet.')}
    </>
  )

  /* ── Pinned footer. Last child of a flex column, and shrink-0, so a long
        conversation scrolls under it rather than pushing it off. ─────────── */
  const footer = (
    <div className="shrink-0 border-t bg-card">
      {errorMessage && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
          <p className="flex-1 text-xs text-destructive">{errorMessage}</p>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        placeholder={placeholder}
        agentType="overall"
        showChips={false}
      />
      <div className="flex items-center gap-1.5 px-3 pb-2.5 text-[11px] text-muted-foreground">
        <span className="rounded-md border bg-muted/50 px-1.5 py-0.5">Director</span>
        <span className="truncate">{contextLabel}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.55_0.13_155)] dark:bg-[oklch(0.74_0.13_155)]" />
          {departmentCount} departments ready
        </span>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop, expanded: a real column in the layout ───────────────── */}
      {!collapsed && (
        <aside
          data-director-rail="open"
          aria-label="Director"
          className={cn(
            'hidden h-full w-[380px] shrink-0 flex-col border-l bg-card md:flex',
            className,
          )}
        >
          {tabStrip('rail', true)}
          {body('rail')}
          {footer}
        </aside>
      )}

      {/* ── Desktop, collapsed: 52px strip. The way back is right there. ─── */}
      {collapsed && (
        <aside
          data-director-rail="collapsed"
          aria-label="Director, hidden"
          className={cn(
            'hidden h-full w-[52px] shrink-0 flex-col items-center gap-3.5 border-l bg-card py-3 md:flex',
            className,
          )}
        >
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-expanded={false}
            aria-label="Show the Director"
            title="Show the Director"
            className="flex h-7 w-7 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground transition-colors hover:text-foreground"
          >
            <PanelRightOpen className="h-3.5 w-3.5" />
          </button>
          <AgentAvatar agentType="overall" size="sm" />
          <span className="text-[11px] tracking-wider text-muted-foreground [writing-mode:vertical-rl]">
            Director
          </span>
        </aside>
      )}

      {/* ── Mobile: a pill, then a full-height sheet. Opens closed every time
             — on a phone the work needs the whole screen, and Law 1 says the
             screen is complete without this. ──────────────────────────────── */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Ask the Director"
          className="fixed right-6 bottom-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
        >
          <MessageCircle className="h-4 w-4" />
          Director
        </button>
      )}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div
            data-director-rail="mobile"
            aria-label="Director"
            className="fixed top-0 right-0 z-40 flex h-screen w-full flex-col border-l bg-card shadow-xl md:hidden"
          >
            <div className="flex h-[50px] shrink-0 items-center gap-2 border-b px-3">
              <AgentAvatar agentType="overall" size="sm" />
              <span className="flex-1 text-sm font-medium text-foreground">Director</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close the Director"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {tabStrip('railm', false)}
            {body('railm')}
            {footer}
          </div>
        </>
      )}
    </>
  )
}
