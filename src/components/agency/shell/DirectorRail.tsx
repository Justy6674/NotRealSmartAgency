'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { UIMessage } from 'ai'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  ChevronRight,
  Eraser,
  Eye,
  History,
  Inbox,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react'
import { AgentAvatar } from '@/components/agency/AgentAvatar'
import { ChatInput } from '@/components/agency/ChatInput'
import { ChatMessage } from '@/components/agency/ChatMessage'
import { DirectorHistory, type DirectorConversation } from '@/components/agency/shell/DirectorHistory'
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

   ── MEMORY (added after the rail took over Recent Chats) ─────────────────
   The sidebar used to carry thirty past conversations. It does not any more:
   history belongs with the talking, the way Claude, ChatGPT and the Supabase
   assistant all do it. So the rail now answers three questions the owner is
   entitled to ask of anything that remembers him:

     · What have we said before?  → "Previous chats", in the rail header.
     · What do you know right now? → the context line, always on screen. It
       used to say only "sees this screen", which implied the memory without
       ever stating it. Implied is not legible.
     · How do I make you forget?  → two controls, two DIFFERENT scopes, and a
       confirm that names which one is about to happen. Clearing a
       conversation and wiping everything learnt about a business are not the
       same act and must never be one button.

   The rail still owns no action on the owner's WORK — nothing in here
   publishes, saves, schedules or connects. The only things it can destroy are
   its own memory, both behind a confirm, and neither is the sole route: chats
   remain at /agency/chat/:id and what is remembered is also editable on its
   own screen.

   Every one of these controls is drawn ONLY when the matching callback is
   supplied. An unwired rail shows no History button rather than a button that
   opens an empty drawer forever.

   Where the container gets the data (there is exactly one history store —
   do not build a second):
     · list      GET    /api/conversations?brandId=<uuid>   (50, newest first)
     · resume    GET    /api/conversations/<id>/messages
     · forget    DELETE /api/memories?scope=brand&brandId=<uuid>  → {deleted:n}
   ══════════════════════════════════════════════════════════════════════════ */

export type DirectorRailTab = 'director' | 'preview' | 'activity' | 'analytics'

/**
 * The two things "clear" can mean, kept apart everywhere they are handled so
 * that no code path can quietly widen the smaller one into the larger.
 *
 * `conversation` — this thread only. What has been learnt about the business
 *   survives, which is why it is the safe, ordinary one.
 * `business`     — everything the Director has learnt about this business,
 *   across every conversation. Not undoable, so it is never the default and
 *   never one press away.
 */
export type DirectorClearScope = 'conversation' | 'business'

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

  /* ── Memory: history, a fresh start, and forgetting ──────────────────────
     Same seam as the conversation. The rail is handed a list and hands back a
     click; the container owns `/api/conversations`, the store and the delete.
     Each control appears only when its callback is supplied. */

  /** Newest first, straight from `/api/conversations?brandId=`. */
  conversations?: DirectorConversation[]
  /** True while the first load is in flight — distinct from "there are none". */
  historyLoading?: boolean
  /** The list could not be loaded. The panel says so; it never shows why. */
  historyFailed?: boolean
  /** Highlights the open thread. `useAgencyStore.activeConversationId`. */
  activeConversationId?: string | null
  /**
   * Resume a thread. The whole row is passed, not the id, because the store
   * needs the department too — `selectConversation(id, agent_type)`.
   */
  onSelectConversation?: (conversation: DirectorConversation) => void
  /**
   * Fired when the drawer opens, so a container can fetch the list lazily
   * instead of on every screen. Supplying this alone (with no `conversations`)
   * is enough to draw the control — the loading state covers the gap.
   */
  onOpenHistory?: () => void
  /**
   * Start a fresh thread. Distinct from clearing: nothing is destroyed, the
   * old conversation is still in the list. This is the one an owner who just
   * wants a clean slate should reach for, so it sits in the header, not in the
   * menu with the destructive pair.
   */
  onNewConversation?: () => void
  /**
   * Forget this conversation. Everything learnt about the business survives.
   * Return a promise to have the confirm sit on "Clearing…" until it settles.
   */
  onClearConversation?: () => void | Promise<unknown>
  /**
   * Forget everything learnt about this business. Not undoable. Return a
   * promise as above.
   */
  onForgetBusiness?: () => void | Promise<unknown>
  /**
   * How many earlier conversations exist. Supply it cheaply (a count) so the
   * context line can be honest before the list itself has ever been loaded;
   * otherwise it falls back to the length of `conversations`.
   */
  historyCount?: number | null
  /**
   * How many things the Director has learnt about this business — the row
   * count behind `DELETE /api/memories?scope=brand`. It makes the destructive
   * scope concrete ("23 things it has learnt") instead of abstract. `null` or
   * omitted means unknown, and unknown is said by saying nothing.
   */
  rememberedFactCount?: number | null
  /**
   * Override the confirm copy when the container's clear does MORE than the
   * defaults describe. The defaults promise that posts, drafts and media are
   * untouched and that earlier chats stay in the list; if that stops being
   * true, the copy must change with it or the confirm becomes a lie.
   */
  clearConversationDescription?: string
  forgetBusinessDescription?: string

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

/* ── What the Director knows, said out loud ────────────────────────────────
   Assembled from clauses rather than written as four fixed sentences, because
   every one of the inputs can legitimately be absent: a container may know the
   conversation and nothing else, or the count of past chats but not the count
   of remembered facts. A sentence built from what is actually known cannot
   claim a memory that is not there — and "unknown" is expressed by leaving the
   clause out, never by printing a confident zero. */

function countPhrase(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function listPhrase(parts: string[]): string {
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function memorySentence({
  messageCount,
  historyCount,
  factCount,
  brandName,
}: {
  messageCount: number
  historyCount: number | null
  factCount: number | null
  brandName?: string | null
}): string {
  const parts: string[] = []
  if (messageCount > 0) parts.push('everything said in this chat')
  if (historyCount && historyCount > 0) {
    parts.push(countPhrase(historyCount, 'earlier chat', 'earlier chats'))
  }
  if (factCount && factCount > 0) {
    const about = brandName ? ` about ${brandName}` : ''
    parts.push(`${countPhrase(factCount, 'thing', 'things')} it has picked up${about}`)
  }

  if (parts.length === 0) {
    return messageCount > 0
      ? 'Remembers everything said in this chat.'
      : 'Nothing remembered yet — this is a fresh start.'
  }
  return `Remembers ${listPhrase(parts)}.`
}

/**
 * The confirm copy. Both scopes state what goes, what STAYS, and — for the
 * one that cannot be undone — that it cannot be undone. "Are you sure?" is not
 * a question anyone can answer; "your posts and photos are not touched" is.
 */
function clearCopy(scope: DirectorClearScope, brandName: string | null | undefined, factCount: number | null) {
  const business = brandName ?? 'this business'

  if (scope === 'conversation') {
    return {
      scopeLabel: 'This chat only',
      title: 'Clear this chat?',
      body:
        `The Director forgets what has been said in this chat and starts with a blank page. ` +
        `What it has learnt about ${business} — how you like to sound, the rules you have set — stays. ` +
        `Your posts, drafts and photos are not touched.`,
      confirmLabel: 'Clear this chat',
      destructive: false,
    }
  }

  const learnt =
    factCount && factCount > 0
      ? ` — ${countPhrase(factCount, 'thing', 'things')} in all`
      : ''
  return {
    scopeLabel: `Everything about ${business}`,
    title: `Forget everything about ${business}?`,
    body:
      `The Director forgets everything it has learnt about ${business}${learnt}: how you like to sound, ` +
      `the rules you have set, and anything it picked up from earlier chats. It will start again from nothing ` +
      `and you will have to teach it a second time. Your posts, drafts, photos and videos are not touched, ` +
      `and your earlier chats stay in the list. This cannot be undone.`,
    confirmLabel: 'Forget everything',
    destructive: true,
  }
}

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
  conversations,
  historyLoading = false,
  historyFailed = false,
  activeConversationId = null,
  onSelectConversation,
  onOpenHistory,
  onNewConversation,
  onClearConversation,
  onForgetBusiness,
  historyCount,
  rememberedFactCount = null,
  clearConversationDescription,
  forgetBusinessDescription,
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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmScope, setConfirmScope] = useState<DirectorClearScope | null>(null)
  const [clearing, setClearing] = useState(false)
  const [clearFailed, setClearFailed] = useState(false)
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
    if (tab !== 'director' || historyOpen) return
    conversationEndRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [messages, tab, historyOpen])

  /* ── Memory controls ─────────────────────────────────────────────────────
     Each is drawn only when its callback exists, so the unwired rail (the
     layout mounts it today with `brandName` and nothing else) grows no dead
     buttons. */
  const canBrowseHistory = conversations !== undefined || onOpenHistory !== undefined
  const canClearConversation = onClearConversation !== undefined
  const canForgetBusiness = onForgetBusiness !== undefined
  const canForget = canClearConversation || canForgetBusiness

  const openHistory = useCallback(() => {
    setMenuOpen(false)
    setHistoryOpen(true)
    // Fired every open, not once: a list fetched an hour ago is stale, and the
    // container is the only thing that knows whether re-fetching is cheap.
    onOpenHistory?.()
  }, [onOpenHistory])

  const handleSelectConversation = useCallback(
    (conversation: DirectorConversation) => {
      // The drawer closes, the sheet does NOT. On a phone the conversation the
      // owner just picked renders in this same panel — closing the sheet the
      // way the old sidebar did would hide the thing he asked for.
      setHistoryOpen(false)
      onSelectConversation?.(conversation)
    },
    [onSelectConversation],
  )

  const handleNewConversation = useCallback(() => {
    setMenuOpen(false)
    setHistoryOpen(false)
    onNewConversation?.()
  }, [onNewConversation])

  const requestClear = useCallback((scope: DirectorClearScope) => {
    setMenuOpen(false)
    setClearFailed(false)
    setConfirmScope(scope)
  }, [])

  const cancelClear = useCallback(() => {
    if (clearing) return
    setConfirmScope(null)
    setClearFailed(false)
  }, [clearing])

  /**
   * The confirmed act. A callback may be synchronous or return a promise; both
   * are awaited so the button can sit on "Clearing…" rather than closing on a
   * delete that has not landed yet — the owner would read that as done.
   *
   * A failure keeps the dialog open and says one fixed sentence. It never
   * renders what the failure said: a tool string is read aloud to the owner in
   * this app, and a raw error is exactly what `no-raw-errors.test.ts` exists to
   * keep out of his face.
   */
  const runClear = useCallback(async () => {
    if (!confirmScope || clearing) return
    const act = confirmScope === 'business' ? onForgetBusiness : onClearConversation
    if (!act) {
      setConfirmScope(null)
      return
    }

    setClearing(true)
    setClearFailed(false)
    try {
      await act()
      setConfirmScope(null)
      setHistoryOpen(false)
    } catch (err) {
      console.error('[director-rail] clear failed', err)
      setClearFailed(true)
    } finally {
      setClearing(false)
    }
  }, [clearing, confirmScope, onClearConversation, onForgetBusiness])

  // Escape closes whatever is on top, innermost first. The confirm outranks
  // the menu, and neither may be dismissed while a delete is in flight.
  useEffect(() => {
    if (!menuOpen && !confirmScope) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (confirmScope) {
        if (!clearing) {
          setConfirmScope(null)
          setClearFailed(false)
        }
        return
      }
      setMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [menuOpen, confirmScope, clearing])

  // The desktop rail and the mobile sheet are both mounted, so the menu exists
  // twice in the DOM and a ref to "the" menu would be wrong half the time.
  // Matching on the marker attribute is correct for both.
  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-director-memory-menu]')) return
      setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  const visibleProposals = proposals.filter((p) => !dismissed.has(p.id))
  const visibleSuggestions = suggestions.filter((s) => !dismissed.has(s.id))
  const placeholder = brandName ? `Ask NRS about ${brandName}…` : 'Ask NRS…'

  /* An explicit `historyCount` is preferred over the list's length: a
     container that loads the list lazily has none of it yet, and "0 earlier
     chats" is a claim, not a blank. `null` stays null all the way to the
     sentence, which then simply omits the clause. */
  const knownHistoryCount =
    historyCount ?? (conversations && conversations.length > 0 ? conversations.length : null)
  const memoryLine = memorySentence({
    messageCount: messages.length,
    historyCount: knownHistoryCount,
    factCount: rememberedFactCount,
    brandName,
  })

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
              onClick={() => {
                setTab(id)
                // Leaving the Director tab abandons the history drawer, so
                // coming back lands on the conversation rather than on a list
                // the owner has long since stopped looking at.
                setHistoryOpen(false)
              }}
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

  /* ── The context bar: what the Director knows, above the conversation ────
        It sits OUTSIDE the scrolling region on purpose. Scrolled away, "knows
        Downscale, sees this screen, remembers 12 earlier chats" is a thing the
        interface said once — and a memory the owner has to remember is not a
        memory he can trust. Only on the Director tab: the other three are not
        conversations and would be claiming a context they do not have. */
  const contextBar = (scope: string) => (
    <div className="shrink-0 border-b bg-card px-3 py-2">
      {(canBrowseHistory || onNewConversation || canForget) && (
        <div className="mb-1.5 flex items-center gap-1">
          {canBrowseHistory && (
            <button
              type="button"
              onClick={openHistory}
              className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <History className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Previous chats</span>
              {knownHistoryCount !== null && knownHistoryCount > 0 && (
                <span className="shrink-0 rounded-full border px-1.5 text-[10px] leading-4">
                  {knownHistoryCount}
                </span>
              )}
            </button>
          )}
          {onNewConversation && (
            <button
              type="button"
              onClick={handleNewConversation}
              title="Start a new chat. Nothing is deleted."
              className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SquarePen className="h-3.5 w-3.5" />
              New chat
            </button>
          )}

          {canForget && (
            <div data-director-memory-menu className="relative ml-auto shrink-0">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="What the Director remembers"
                title="What the Director remembers"
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  aria-label="What the Director remembers"
                  className="absolute top-7 right-0 z-20 w-[248px] overflow-hidden rounded-xl border bg-card py-1 shadow-lg"
                >
                  {/* Both scopes are spelled out in the menu as well as in the
                      confirm. Reading the consequence only after pressing is
                      how a person ends up somewhere they did not choose. */}
                  {canClearConversation && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => requestClear('conversation')}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <Eraser className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-tight text-foreground">
                          Clear this chat
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                          Forgets what was said here. Keeps what it has learnt.
                        </span>
                      </span>
                    </button>
                  )}
                  {canForgetBusiness && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => requestClear('business')}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <Trash2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-tight text-foreground">
                          Forget everything about {brandName ?? 'this business'}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">
                          Wipes everything it has learnt. Cannot be undone.
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <p id={`${scope}-context`} className="text-[11px] leading-relaxed text-muted-foreground">
        {brandName && <span className="font-medium text-foreground">{brandName}</span>}
        {brandName ? ' · ' : ''}
        {contextLabel}
        {'. '}
        {memoryLine}
      </p>
    </div>
  )

  /* ── Director tab: context → conversation → proposals → suggested → notes ─ */
  const directorPanel = (scope: string) => (
    <div
      role="tabpanel"
      id={`${scope}-panel-director`}
      aria-labelledby={`${scope}-tab-director`}
      aria-describedby={`${scope}-context`}
      className="flex min-h-0 flex-1 flex-col"
    >
      {contextBar(scope)}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
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
    </div>
  )

  /* ── The history drawer. Takes over the conversation area only — the input
        stays pinned below it, because law 2 says the Director's box is on
        every screen and browsing what was said last week is not a reason to
        take away the way to say something now. ──────────────────────────── */
  const historyPanel = (scope: string) => (
    <div
      role="tabpanel"
      id={`${scope}-panel-director`}
      aria-labelledby={`${scope}-tab-director`}
      className="flex min-h-0 flex-1 flex-col"
    >
      <DirectorHistory
        conversations={conversations ?? []}
        activeConversationId={activeConversationId}
        isLoading={historyLoading}
        loadFailed={historyFailed}
        brandName={brandName}
        onSelect={handleSelectConversation}
        onNew={onNewConversation ? handleNewConversation : undefined}
        onClose={() => setHistoryOpen(false)}
      />
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
      {tab === 'director' && (historyOpen ? historyPanel(scope) : directorPanel(scope))}
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

  /* ── The confirm. Forgetting is the one thing in here that cannot be undone,
        so it gets a full stop rather than a toast with an undo that would have
        to be a lie (the rows are already gone from the database).

        It is deliberately NOT `window.confirm`: that dialog can hold one line,
        cannot say what SURVIVES, and looks like a browser warning rather than
        something this product meant. What is lost and what is kept both have
        to fit, or the owner is guessing. ─────────────────────────────────── */
  const confirmOverlay = (scope: string) => {
    if (!confirmScope) return null
    const copy = clearCopy(confirmScope, brandName, rememberedFactCount)
    const override =
      confirmScope === 'business' ? forgetBusinessDescription : clearConversationDescription

    return (
      <div className="absolute inset-0 z-40 flex items-end bg-black/40 p-3" role="presentation">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={`${scope}-confirm-title`}
          aria-describedby={`${scope}-confirm-body`}
          className="w-full rounded-xl border bg-card p-3 shadow-xl"
        >
          {/* The scope, named before the question is asked. The two acts read
              similarly at a glance and the owner must be able to tell, without
              parsing a sentence, which one is in front of him. */}
          <p
            className={cn(
              'mb-1.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase',
              copy.destructive
                ? 'bg-destructive/10 text-destructive'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {copy.scopeLabel}
          </p>
          <p id={`${scope}-confirm-title`} className="text-sm font-semibold text-foreground">
            {copy.title}
          </p>
          <p
            id={`${scope}-confirm-body`}
            className="mt-1.5 text-xs leading-relaxed text-muted-foreground"
          >
            {override ?? copy.body}
          </p>

          {clearFailed && (
            <p className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
              That did not go through. Nothing has been changed — have another go in a moment.
            </p>
          )}

          <div className="mt-3 flex items-center justify-end gap-1.5">
            {/* Keep is first and focused: the safe way out should be the one a
                stray Enter takes. */}
            <button
              type="button"
              autoFocus
              onClick={cancelClear}
              disabled={clearing}
              className="rounded-lg border px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Keep it
            </button>
            <button
              type="button"
              onClick={() => void runClear()}
              disabled={clearing}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
                copy.destructive
                  ? 'bg-destructive text-white hover:opacity-90'
                  : 'bg-foreground text-background hover:opacity-90',
              )}
            >
              {clearing && <Loader2 className="h-3 w-3 animate-spin" />}
              {clearing ? 'Clearing…' : copy.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Desktop, expanded: a real column in the layout ───────────────── */}
      {!collapsed && (
        <aside
          data-director-rail="open"
          aria-label="Director"
          className={cn(
            // `relative` so the confirm covers the rail and nothing else — a
            // page-wide modal from a 380px column reads as the whole app
            // stopping, when what is being decided is only the Director's.
            'relative hidden h-full w-[380px] shrink-0 flex-col border-l bg-card md:flex',
            className,
          )}
        >
          {tabStrip('rail', true)}
          {body('rail')}
          {footer}
          {confirmOverlay('rail')}
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
            {confirmOverlay('railm')}
          </div>
        </>
      )}
    </>
  )
}
