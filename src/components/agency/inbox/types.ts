/**
 * What the inbox is, and why it does not read the `tasks` table.
 *
 * The Zernio webhook was built to turn every incoming DM into a task. It has
 * never created one and cannot: it looks up the brand with
 * `ilike '%scentsell%'` while the brand is named "Scent Sell" with a space, it
 * writes `status: 'pending'` which is not in the `task_status` enum, and it
 * writes the string `'overall'` into a uuid foreign key. None of the three is
 * error-checked, so the route answers 200 and Zernio never retries. Live count
 * of tasks carrying a Zernio conversation id: zero.
 *
 * Meanwhile the Zernio API has twenty real Scent Sell conversations in it right
 * now. So this reads the API. When the webhook is repaired the task rows become
 * a second, richer source; until then they would only render an empty screen.
 *
 * The one thing this deliberately will NOT do is claim the Director handled
 * something. There is no field anywhere that distinguishes an NRS reply from
 * Justin answering by hand in the Instagram app — and one live thread ends with
 * an outgoing message signed "Justin", which proves the hand path is in use.
 * So an outgoing last message is reported as "Answered", and only a reply NRS
 * itself recorded is reported as "Director handled".
 */

/** Which platform the conversation came in on. Free-form: Zernio adds more. */
export type InboxPlatform = string

export type InboxState =
  /** The customer spoke last. This is the queue. */
  | 'needs_you'
  /** Answered, and NRS holds its own record of sending it. */
  | 'handled'
  /** Answered, but nothing records who. Never claimed as the Director's work. */
  | 'answered'

export interface InboxItem {
  /** Zernio conversation id. Stable, and what `zernio_reply` needs. */
  id: string
  /** Zernio account id. `zernio_reply` needs this too — carry it through. */
  accountId: string
  /** The connected account that received it, e.g. `scentsellsocials`. */
  accountUsername: string | null
  platform: InboxPlatform
  /** Best available name for the person. Facebook has no handle. */
  participantName: string | null
  participantUsername: string | null
  /** Null on every live conversation. Kept so a monogram is always the plan. */
  participantPicture: string | null
  /** Raw preview. May be the literal string "[Attachment]" or empty. */
  lastMessage: string | null
  /** True when the last message carried media rather than words. */
  lastMessageIsMedia: boolean
  /** ISO. Used for both the relative label and the absolute title. */
  updatedAt: string | null
  state: InboxState
  /** Deep link to the real thread. Absent on some rows — always gate on it. */
  url: string | null
}

export interface InboxAccount {
  id: string
  platform: InboxPlatform
  username: string | null
  needsReconnection: boolean
}

export type InboxUnavailableReason =
  /** No ZERNIO_API_KEY on this deployment. */
  | 'not_configured'
  /** Key present, but no social account is connected to it. */
  | 'no_accounts'
  /** Upstream could not be read. Distinct from "nothing has come in". */
  | 'unreachable'

export interface InboxResponse {
  items: InboxItem[]
  accounts: InboxAccount[]
  /** Null when the inbox could be read. Set when it could not, or is not set up. */
  unavailable: InboxUnavailableReason | null
  /**
   * Whether the list is scoped to one brand or to every connected account.
   * The brand→Zernio link lives in `brands.social_urls.zernio_profile_id`, and
   * on the live Scent Sell brand that key is not set — so today this is
   * 'workspace' and the page says so rather than implying a brand filter.
   */
  scope: 'brand' | 'workspace'
  /**
   * Accounts Zernio itself failed to read. Greater than zero means the list is
   * incomplete, which is a different thing from being short.
   */
  accountsFailed: number
  /** Set only when the whole read failed. Already made safe for a person. */
  error?: string
}

/** Facebook conversations carry no handle, so `@` alone must never be printed. */
export function displayName(item: InboxItem): string {
  return item.participantName?.trim() || item.participantUsername?.trim() || 'Someone'
}

/** The handle, with its `@`, or nothing at all. Never a bare `@`. */
export function displayHandle(item: InboxItem): string | null {
  const handle = item.participantUsername?.trim()
  if (!handle) return null
  return handle.startsWith('@') ? handle : `@${handle}`
}

/** Two letters for the avatar that never arrives — every picture is null. */
export function monogram(item: InboxItem): string {
  const name = displayName(item)
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
}

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1)
}

/** Matches the codebase's existing relative-time treatment (PostActivityItem). */
export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 30) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 1) return `${secs}s ago`
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-AU')
}

export function absoluteTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-AU', { dateStyle: 'full', timeStyle: 'short' })
  } catch {
    return dateStr
  }
}

/* ── The Engagement desk's wire shapes ──────────────────────────────────────
 *
 * One declaration per shape, read by BOTH the route that produces it and the
 * hook that consumes it. They were written out twice, field for field, on the
 * server and again in `useEngagement.ts`. Nothing kept the two copies in step:
 * adding a field to a route left the client silently blind to it, and renaming
 * one on the client left a compiler that agreed with itself and a screen that
 * showed nothing. A wire contract has to be one object or it is not a contract.
 */

/** One comment under one of this business's posts. */
export interface DeskComment {
  id: string
  authorName: string | null
  message: string
  createdAt: string | null
  likeCount: number
  replyCount: number
  hidden: boolean
  /** True when this is the brand's own comment rather than somebody else's. */
  fromUs: boolean
}

/** One message inside a conversation thread. */
export interface DeskMessage {
  id: string
  text: string
  incoming: boolean
  at: string | null
  attachmentUrl: string | null
}

/** Somebody naming this business somewhere other than under its own post. */
export interface DeskMention {
  id: string
  authorName: string | null
  message: string
  createdAt: string | null
  url: string | null
  accountId: string | null
  /** Needed to reply. Absent on rows that cannot be answered from here. */
  mediaId: string | null
}

/** A review left on a listing — Google or Facebook. */
export interface DeskReview {
  id: string
  authorName: string | null
  rating: number | null
  comment: string
  createdAt: string | null
  accountId: string | null
  platform: string | null
  /** The brand's existing reply, when there is one. */
  reply: string | null
  url: string | null
}
