/**
 * ONE conversation, in one order.
 *
 * The Mini App did not have a timeline. It had three lists rendered in fixed
 * blocks — chat messages, then a "Working…" spinner, then media — and the
 * media list was sorted NEWEST FIRST inside a chat that reads top to bottom.
 * So a clip uploaded at 00:22 rendered below a message sent at 16:05, above a
 * clip from 06:04, and the chat text vanished entirely on reload because it
 * only ever lived in React state. The owner called it unusable, which it was.
 *
 * This module is the single ordering authority. Nothing else sorts timeline
 * data — not the route, not the page, not a component.
 *
 * THE ONE IDEA: GROUPS, NOT LOOSE EVENTS.
 *
 * A group is one thing the owner did plus everything that came out of it: his
 * question and the Director's answer; his upload, its transcription and the
 * proposal written from it. The group is anchored to the instant of the OWNER'S
 * action and that anchor never changes.
 *
 * This is what makes it behave like any other AI chat. If a reply sorted by
 * when it finished, then anything arriving while the Director was thinking
 * would shove the answer down the screen as it was being read — and a job that
 * takes four minutes would deliver its answer four minutes' worth of messages
 * away from the question that caused it. Anchoring to the question means the
 * pending bubble and the answer that replaces it occupy the same slot: the
 * resolution is a swap in place, and it cannot move no matter how long it
 * takes or what lands in the meantime.
 *
 * The cost, stated plainly: an upload at 06:07 renders below the answer to a
 * 06:06 question that finished at 06:12. That is the same trade ChatGPT and
 * Claude make, and it is why no per-message clock is rendered — only day
 * separators, so there is never a visibly out-of-order time on screen.
 *
 * PURE. No react, no next, no supabase, no fetch, and no ambient clock — `now`
 * is always passed in, so every test is deterministic.
 */

export type TimelineEventKind =
  | 'user_message'
  | 'media_upload'
  | 'director_pending'
  | 'director_reply'
  | 'director_error'
  | 'carousel_delivery'
  | 'proposal'

export type TimelineGroupKind = 'turn' | 'clip' | 'output'

export type TimelineEventPayload =
  | { kind: 'user_message'; text: string; mediaIds: string[]; status: 'sent' | 'failed' }
  | {
      kind: 'media_upload'
      mediaItemId: string | null
      fileName: string
      fileType: string
      thumbnailUrl: string | null
      stage: 'uploading' | 'listening' | 'ready' | 'no_draft' | 'failed'
      transcriptionStatus: string | null
      uploadPercent: number
      /** Set when this clip belongs inside an owner message bubble. */
      containedByEventId: string | null
    }
  | { kind: 'director_pending'; jobId: string | null; label: string; waitingSinceMs: number }
  | { kind: 'director_reply'; jobId: string; text: string; withheld: boolean }
  | {
      /** A finished, reviewable carousel. This is never emitted from copy alone. */
      kind: 'carousel_delivery'
      jobId: string
      title: string
      outputId: string | null
      platform: string
      caption: string
      hashtags: string[]
      slides: Array<{ mediaItemId: string; fileUrl: string; fileName: string }>
      approved: boolean
      mixpost: 'synced' | 'pending' | 'failed' | 'skipped' | 'duplicate' | null
    }
  | {
      kind: 'director_error'
      jobId: string | null
      text: string
      retryText: string | null
      retryClientEventId: string | null
    }
  | {
      kind: 'proposal'
      outputId: string
      mediaItemIds: string[]
      aboutFileName: string | null
      opener: string
      hook: string
      caption: string
      hashtags: string[]
      postType: string
      platform: string
      approved: boolean
      mixpost: 'synced' | 'pending' | 'failed' | 'skipped' | 'duplicate' | null
      withheld: boolean
    }

/** What a source adapter emits. Grouping is a request; the builder resolves it. */
export interface TimelineSourceEvent {
  /** React key and merge key. Namespaced per source so ids cannot collide. */
  id: string
  kind: TimelineEventKind
  /**
   * null means this event OWNS its group — it is something the owner did.
   * Otherwise it is the id of the event whose group this one joins. Resolved
   * recursively, so a chain (clip → proposal → approval → published) works
   * without anyone maintaining a pass order.
   */
  groupParentId: string | null
  /** This event's own true instant, epoch ms UTC. Null when unknown. */
  occurredAtMs: number | null
  side: 'owner' | 'director'
  brandId: string
  /**
   * The id the CLIENT minted for the owner action that produced this event.
   *
   * How an optimistic message on screen is recognised as the same message once
   * the server reports it back. Matching on a string prefix instead would be a
   * guess; this is the same value the server stored, so the correlation is
   * exact — and it is also the key that stops a double-tapped Retry starting a
   * second Director run.
   */
  clientEventId?: string | null
  payload: TimelineEventPayload
}

/** What the client receives — the source event plus the resolved grouping. */
export interface TimelineEvent extends TimelineSourceEvent {
  groupId: string
  /** THE sort key: the instant of the owner action that started this group. */
  groupAnchorMs: number
  memberRank: number
  /** Display metadata only. NEVER a sort input. */
  occurredAt: string | null
}

/**
 * Where an event sits WITHIN its group.
 *
 * The owner's action first, then the Director's answer to it, then anything
 * derived. A pending, a reply and an error all share rank 1 because they are
 * the same slot in three states — which is precisely why an answer replaces a
 * spinner rather than appearing somewhere else.
 */
export const MEMBER_RANK: Record<TimelineEventKind, number> = {
  user_message: 0,
  media_upload: 0,
  director_pending: 1,
  director_reply: 1,
  director_error: 1,
  carousel_delivery: 2,
  proposal: 2,
}

/** Tie-break when two groups start in the same millisecond. */
export const GROUP_RANK: Record<TimelineGroupKind, number> = { turn: 0, clip: 1, output: 2 }

/**
 * How long a job may run before it is shown as stalled.
 *
 * Past `maxDuration` (300s) plus room for the continuation to overrun, so a
 * job that is merely slow is never reported as broken. A late answer still
 * replaces the message if it arrives — server-owned history is the whole
 * point — and that is safe because a retry reuses the same client_event_id and
 * so cannot start a second run.
 */
export const STALE_AFTER_MS = 420_000

/** Groups per page. Paging is by GROUP so a question is never split from its answer. */
export const PAGE_GROUPS = 20

export function toUtcMs(value: string | null | undefined): number | null {
  if (!value) return null
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

function groupKindOf(groupId: string): TimelineGroupKind {
  const prefix = groupId.slice(0, groupId.indexOf(':'))
  return prefix === 'turn' || prefix === 'clip' || prefix === 'output' ? prefix : 'output'
}

/**
 * A total order. Steps 3 and 5 mean it never relies on sort stability, so a
 * shuffled input produces byte-identical output — which is what lets the tests
 * assert an exact sequence.
 */
export function compareTimelineEvents(a: TimelineEvent, b: TimelineEvent): number {
  if (a.groupAnchorMs !== b.groupAnchorMs) return a.groupAnchorMs - b.groupAnchorMs

  const groupRank = GROUP_RANK[groupKindOf(a.groupId)] - GROUP_RANK[groupKindOf(b.groupId)]
  if (groupRank !== 0) return groupRank

  if (a.groupId !== b.groupId) return a.groupId < b.groupId ? -1 : 1

  const member = MEMBER_RANK[a.kind] - MEMBER_RANK[b.kind]
  if (member !== 0) return member

  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

interface ResolvedGroup {
  groupId: string
  anchorMs: number
}

/**
 * Walk up to the owner action that started this group.
 *
 * Memoised and cycle-guarded: data is not supposed to contain a loop, but a
 * loop must not hang the request. On a cycle the event falls back to owning
 * its own group, which shows it in the wrong place rather than not at all.
 */
export function resolveGroupAnchor(
  event: TimelineSourceEvent,
  byId: Map<string, TimelineSourceEvent>,
  memo: Map<string, ResolvedGroup | null>,
  seen: Set<string> = new Set(),
): ResolvedGroup | null {
  const cached = memo.get(event.id)
  if (cached !== undefined) return cached

  if (seen.has(event.id)) {
    const fallback = ownGroup(event)
    memo.set(event.id, fallback)
    return fallback
  }
  seen.add(event.id)

  if (event.groupParentId === null) {
    const own = ownGroup(event)
    memo.set(event.id, own)
    return own
  }

  const parent = byId.get(event.groupParentId)
  if (!parent) {
    // The parent fell outside the page window. Stand alone rather than vanish.
    const own = ownGroup(event)
    memo.set(event.id, own)
    return own
  }

  const resolved = resolveGroupAnchor(parent, byId, memo, seen)
  memo.set(event.id, resolved)
  return resolved
}

function ownGroup(event: TimelineSourceEvent): ResolvedGroup | null {
  if (event.occurredAtMs === null) return null
  const prefix: TimelineGroupKind =
    event.kind === 'media_upload'
      ? 'clip'
      : event.kind === 'proposal' || event.kind === 'carousel_delivery'
        ? 'output'
        : 'turn'
  return { groupId: `${prefix}:${event.id}`, anchorMs: event.occurredAtMs }
}

export interface BuildTimelineResult {
  events: TimelineEvent[]
  /** Events that could not be placed at all, so this is never silent. */
  dropped: number
}

/**
 * Resolve grouping, then sort. The only place either happens.
 */
export function buildTelegramTimeline({
  events,
}: {
  events: readonly TimelineSourceEvent[]
}): BuildTimelineResult {
  const byId = new Map(events.map((event) => [event.id, event]))
  const memo = new Map<string, ResolvedGroup | null>()

  const resolved: TimelineEvent[] = []
  let dropped = 0

  for (const event of events) {
    const group = resolveGroupAnchor(event, byId, memo)
    if (!group) {
      dropped += 1
      continue
    }
    resolved.push({
      ...event,
      groupId: group.groupId,
      groupAnchorMs: group.anchorMs,
      memberRank: MEMBER_RANK[event.kind],
      occurredAt: event.occurredAtMs === null ? null : new Date(event.occurredAtMs).toISOString(),
    })
  }

  resolved.sort(compareTimelineEvents)
  return { events: resolved, dropped }
}

/**
 * Take the newest N groups, whole.
 *
 * By group and never by event: slicing a flat list can cut between a question
 * and its answer, so the first thing on screen would be a reply to a question
 * that is not there.
 */
export function takeNewestGroups(events: readonly TimelineEvent[], groups = PAGE_GROUPS): {
  events: TimelineEvent[]
  oldestAnchorMs: number | null
  hasMore: boolean
} {
  const order: string[] = []
  const seen = new Set<string>()
  for (const event of events) {
    if (!seen.has(event.groupId)) {
      seen.add(event.groupId)
      order.push(event.groupId)
    }
  }

  if (order.length <= groups) {
    return {
      events: [...events],
      oldestAnchorMs: events.length > 0 ? events[0].groupAnchorMs : null,
      hasMore: false,
    }
  }

  const keep = new Set(order.slice(order.length - groups))
  const kept = events.filter((event) => keep.has(event.groupId))
  return {
    events: kept,
    oldestAnchorMs: kept.length > 0 ? kept[0].groupAnchorMs : null,
    hasMore: true,
  }
}

/**
 * Merge a server page over what is on screen, keeping optimistic local events
 * that the server has not caught up with yet.
 *
 * Server wins on id. A local event whose `client_event_id` the server has now
 * echoed back is dropped, so a just-sent message does not appear twice — once
 * optimistically and once for real.
 */
export function mergeTimeline(
  local: readonly TimelineEvent[],
  server: readonly TimelineEvent[],
): TimelineEvent[] {
  const serverIds = new Set(server.map((event) => event.id))
  const echoed = new Set(
    server.flatMap((event) => (event.clientEventId ? [event.clientEventId] : [])),
  )

  const survivors = local.filter((event) => {
    if (serverIds.has(event.id)) return false
    // The server now has this one under its own id. Keeping the optimistic
    // copy as well is how a sent message appears twice.
    if (event.clientEventId && echoed.has(event.clientEventId)) return false
    return true
  })

  return [...server, ...survivors].sort(compareTimelineEvents)
}
