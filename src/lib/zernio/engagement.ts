/**
 * Comments, messages, mentions and reviews — the conversations under the posts.
 *
 * Depended on by: the Engagement desk (S6) and the "Waiting on you" count in
 * the chrome (S2).
 *
 * ── Why this matters more than it looks ────────────────────────────────
 * Four brands advertise regulated health services. An unmoderated comment under
 * a health post is a compliance exposure, and NRS could not SEE one: thirteen
 * comment operations existed and none were wrapped, while `listInboxComments`
 * returns real Facebook and Instagram rows on the live account today.
 *
 * ── Every outbound reply is publishing ─────────────────────────────────
 * A reply to a comment, a DM, a mention or a Google review reaches the public
 * exactly as a post does, and for a health brand it carries the same AHPRA and
 * TGA obligations. So every function here that SENDS words takes a
 * `ZernioOutboundApproval`, which only `approvedByPublishGate()` can honestly
 * produce from a real `checkPublishAllowed()` result. Reads take none.
 *
 * Never say "Zernio", "inbox API" or a platform's internal id to the owner.
 */

import { fetchZernioAccounts, getZernioClient } from './client'
import { unwrapZernio, ZernioError } from './errors'
import { zernioIdOf, type ZernioOutboundApproval } from './types'

/* ── Comments ──────────────────────────────────────────────────────────── */

export type ZernioCommentPlatform =
  | 'facebook' | 'instagram' | 'twitter' | 'bluesky' | 'threads'
  | 'youtube' | 'linkedin' | 'reddit' | 'metaads'

export interface ZernioCommentedPost {
  id: string
  platform: string
  accountId: string
  accountUsername?: string
  content: string
  picture?: string
  permalink?: string
  createdTime?: string
  commentCount: number
  likeCount: number
  /** True when the comments are under an ad rather than an organic post. */
  isAd: boolean
  adId?: string
  placement?: string
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/* ── Whose data is this? Ours to decide, never Zernio's ────────────────── */

/**
 * The account ids this brand may see.
 *
 * Every read below can be handed a `profileId`, and Zernio accepts it — but a
 * profile is an organisational boundary upstream, not a security one, and
 * `listAccounts({ profileId })` was measured on 2026-08-17 to accept the filter
 * and ignore it. So the argument narrows the payload and NOTHING more: this set
 * is what decides ownership, applied to the rows after they come back.
 */
async function ownAccountIds(profileId: string): Promise<Set<string>> {
  const own = await fetchZernioAccounts(profileId)
  return new Set(own.map((account) => account.id).filter((id) => id !== ''))
}

/**
 * The account a row belongs to, or `''` when it cannot be attributed.
 *
 * `zernioIdOf` because records carry `_id` rather than `id` and a populated
 * reference arrives as `{_id, name}` rather than a string — comparing the raw
 * field to a string matches nothing, silently.
 */
function rowAccountId(raw: unknown): string {
  const rec = (raw ?? {}) as Record<string, unknown>
  return zernioIdOf(rec.accountId ?? rec.account ?? rec.socialAccountId)
}

/**
 * Keep only rows attributable to an account we own. Unattributable = dropped.
 *
 * This fails CLOSED, and the `!id ||` shape it replaces failed open: it kept
 * every row whose account id did not resolve. Compounded by
 * `fetchZernioAccounts` returning `[]` on ANY failure — a rotated key, a 5xx, a
 * timeout — so after a key rotation the allowed set is empty and a fail-open
 * filter shows exactly the rows nobody could attribute. That is the inversion
 * of what a health brand needs: a blank desk is recoverable, one customer
 * reading another's comments is not.
 */
function scopeRows<T>(rows: T[], allowed: Set<string>, idOf: (row: T) => string): T[] {
  return rows.filter((row) => {
    const id = idOf(row)
    return id !== '' && allowed.has(id)
  })
}

/**
 * The same fail-closed rule over an untyped payload.
 *
 * Mentions and reviews are relayed to their desks as the raw envelope, so the
 * rows are scoped in place under whichever key the endpoint used. `removed`
 * travels back because an aggregate computed over rows we then dropped is an
 * aggregate over somebody else's data.
 */
function scopePayloadRows(
  payload: Record<string, unknown>,
  keys: readonly string[],
  allowed: Set<string>,
): { payload: Record<string, unknown>; removed: number } {
  const scoped: Record<string, unknown> = { ...payload }
  let removed = 0
  for (const key of keys) {
    const rows = scoped[key]
    if (!Array.isArray(rows)) continue
    const kept = rows.filter((row) => {
      const id = rowAccountId(row)
      return id !== '' && allowed.has(id)
    })
    removed += rows.length - kept.length
    scoped[key] = kept
  }
  return { payload: scoped, removed }
}

function commentedPostOf(raw: unknown): ZernioCommentedPost | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const id = zernioIdOf(rec)
  if (!id) return null
  return {
    id,
    platform: str(rec.platform) ?? '',
    accountId: zernioIdOf(rec.accountId),
    ...(str(rec.accountUsername) ? { accountUsername: str(rec.accountUsername)! } : {}),
    content: typeof rec.content === 'string' ? rec.content : '',
    ...(str(rec.picture) ? { picture: str(rec.picture)! } : {}),
    ...(str(rec.permalink) ? { permalink: str(rec.permalink)! } : {}),
    ...(str(rec.createdTime) ? { createdTime: str(rec.createdTime)! } : {}),
    commentCount: num(rec.commentCount),
    likeCount: num(rec.likeCount),
    isAd: rec.isAd === true,
    ...(str(rec.adId) ? { adId: str(rec.adId)! } : {}),
    ...(str(rec.placement) ? { placement: str(rec.placement)! } : {}),
  }
}

export interface ZernioCommentsPage {
  posts: ZernioCommentedPost[]
  cursor?: string
  /**
   * Accounts the publisher could not read this time, with why.
   *
   * Surfaced rather than swallowed: "no comments" and "we could not look at
   * three of your accounts" are different sentences, and only one of them is
   * safe to show a health brand.
   */
  failedAccounts: { accountId: string; error: string; retryAfter?: number }[]
}

/** Posts that have comments waiting, newest or busiest first. */
export async function listZernioCommentedPosts(params: {
  profileId?: string
  platform?: ZernioCommentPlatform
  accountId?: string
  since?: string
  minComments?: number
  sortBy?: 'date' | 'comments'
  sortOrder?: 'asc' | 'desc'
  cursor?: string
  limit?: number
}): Promise<ZernioCommentsPage> {
  const zernio = getZernioClient('comments.listInboxComments')
  const result = await zernio.comments.listInboxComments({
    query: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.since ? { since: params.since } : {}),
      ...(params.minComments !== undefined ? { minComments: params.minComments } : {}),
      ...(params.sortBy ? { sortBy: params.sortBy } : {}),
      ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
      limit: params.limit ?? 25,
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('comments.listInboxComments', result as never)

  const rows = Array.isArray(data.data) ? data.data : Array.isArray(data.posts) ? data.posts : []
  let posts = rows
    .map(commentedPostOf)
    .filter((post): post is ZernioCommentedPost => post !== null)

  const allowed = params.profileId ? await ownAccountIds(params.profileId) : null
  if (allowed) posts = scopeRows(posts, allowed, (post) => post.accountId)

  const meta = (data.meta ?? {}) as Record<string, unknown>
  let failedAccounts = Array.isArray(meta.failedAccounts)
    ? meta.failedAccounts.flatMap((entry) => {
        const rec = (entry ?? {}) as Record<string, unknown>
        return [{
          accountId: zernioIdOf(rec.accountId ?? rec),
          error: str(rec.error) ?? 'Could not be read',
          ...(typeof rec.retryAfter === 'number' ? { retryAfter: rec.retryAfter } : {}),
        }]
      })
    : []

  // "Three of your accounts could not be read" must count OUR accounts. The
  // list arrives with an account id on every entry, and an id belonging to
  // another customer is both a wrong number on the desk and a small leak.
  if (allowed) failedAccounts = scopeRows(failedAccounts, allowed, (row) => row.accountId)

  return {
    posts,
    ...(str(meta.cursor) ? { cursor: str(meta.cursor)! } : {}),
    failedAccounts,
  }
}

/** The comments themselves, under one post. */
export async function fetchZernioPostComments(params: {
  postId: string
  accountId: string
  commentId?: string
  cursor?: string
  limit?: number
}): Promise<Record<string, unknown>> {
  const zernio = getZernioClient('comments.getInboxPostComments')
  const result = await zernio.comments.getInboxPostComments({
    path: { postId: params.postId },
    query: {
      accountId: params.accountId,
      ...(params.commentId ? { commentId: params.commentId } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
      limit: params.limit ?? 50,
    },
  })
  return unwrapZernio<Record<string, unknown>>('comments.getInboxPostComments', result as never)
}

/** Reply publicly, under a post or to one comment. Publishing — needs the gate. */
export async function replyToZernioPost(params: {
  postId: string
  accountId: string
  message: string
  commentId?: string
  approval: ZernioOutboundApproval
}): Promise<void> {
  const zernio = getZernioClient('comments.replyToInboxPost')
  const result = await zernio.comments.replyToInboxPost({
    path: { postId: params.postId },
    body: {
      accountId: params.accountId,
      message: params.message,
      ...(params.commentId ? { commentId: params.commentId } : {}),
    },
  })
  if (result.error) {
    throw new ZernioError('comments.replyToInboxPost', 'The reply could not be posted.', {
      cause: result.error,
    })
  }
}

/**
 * Reply privately to whoever left a comment.
 *
 * Quick-reply chips do NOT render in Instagram's Message Requests folder, which
 * is where a cold DM lands — use `buttons` there or the reply looks broken to
 * the one person it was written for.
 */
export async function sendZernioPrivateReply(params: {
  postId: string
  commentId: string
  accountId: string
  message: string
  buttons?: (
    | { type: 'url'; title: string; url: string }
    | { type: 'postback'; title: string; payload: string }
    | { type: 'phone'; title: string; phone: string }
  )[]
  approval: ZernioOutboundApproval
}): Promise<void> {
  const zernio = getZernioClient('comments.sendPrivateReplyToComment')
  const result = await zernio.comments.sendPrivateReplyToComment({
    path: { postId: params.postId, commentId: params.commentId },
    body: {
      accountId: params.accountId,
      message: params.message,
      ...(params.buttons && params.buttons.length > 0 ? { buttons: params.buttons } : {}),
    },
  })
  if (result.error) {
    throw new ZernioError('comments.sendPrivateReplyToComment', 'The private reply could not be sent.', {
      cause: result.error,
    })
  }
}

/**
 * Hide or show a comment.
 *
 * Moderation, not publishing: no words of ours reach anyone, so no approval is
 * required. For a regulated health brand, hiding a comment that makes a
 * therapeutic claim is often the fastest lawful response available.
 */
export async function setZernioCommentHidden(params: {
  postId: string
  commentId: string
  accountId: string
  hidden: boolean
}): Promise<void> {
  const zernio = getZernioClient('comments.hideInboxComment')
  // Hide takes the account in the BODY, unhide takes it in the QUERY. Two
  // shapes for one switch, so they are written out rather than shared — a
  // single call site would have to lie to the compiler to cover both.
  const result = params.hidden
    ? await zernio.comments.hideInboxComment({
        path: { postId: params.postId, commentId: params.commentId },
        body: { accountId: params.accountId },
      })
    : await zernio.comments.unhideInboxComment({
        path: { postId: params.postId, commentId: params.commentId },
        query: { accountId: params.accountId },
      })
  if (result.error) {
    throw new ZernioError('comments.hideInboxComment', 'That comment could not be updated.', {
      cause: result.error,
    })
  }
}

export async function deleteZernioComment(params: {
  postId: string
  commentId: string
  accountId: string
}): Promise<void> {
  const zernio = getZernioClient('comments.deleteInboxComment')
  const result = await zernio.comments.deleteInboxComment({
    path: { postId: params.postId },
    query: { accountId: params.accountId, commentId: params.commentId },
  })
  if (result.error) {
    throw new ZernioError('comments.deleteInboxComment', 'That comment could not be removed.', {
      cause: result.error,
    })
  }
}

/* ── Conversations ─────────────────────────────────────────────────────── */

export interface ZernioConversation {
  id: string
  platform: string
  accountId: string
  status: 'active' | 'archived'
  /** The cheap way to count what is waiting — no per-conversation fetch. */
  unreadCount: number
  lastMessageAt?: string
  contactName?: string
  url?: string
  /** Meta click attribution: which ad this message came from, when it did. */
  attribution: Record<string, unknown>
}

function conversationOf(raw: unknown): ZernioConversation | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const id = zernioIdOf(rec)
  if (!id) return null
  const metadata = (rec.metadata && typeof rec.metadata === 'object'
    ? rec.metadata as Record<string, unknown>
    : {})
  const contact = (rec.contact ?? {}) as Record<string, unknown>
  return {
    id,
    platform: str(rec.platform) ?? '',
    accountId: zernioIdOf(rec.accountId),
    status: rec.status === 'archived' ? 'archived' : 'active',
    unreadCount: num(rec.unreadCount),
    ...(str(rec.lastMessageAt) ? { lastMessageAt: str(rec.lastMessageAt)! } : {}),
    ...(str(rec.contactName) ?? str(contact.name)
      ? { contactName: (str(rec.contactName) ?? str(contact.name))! }
      : {}),
    ...(str(rec.url) ? { url: str(rec.url)! } : {}),
    attribution: metadata,
  }
}

export async function listZernioConversations(params: {
  profileId?: string
  accountId?: string
  platform?: 'facebook' | 'instagram' | 'twitter' | 'bluesky' | 'reddit' | 'telegram' | 'whatsapp'
  status?: 'active' | 'archived'
  cursor?: string
  limit?: number
}): Promise<ZernioConversation[]> {
  const zernio = getZernioClient('messages.listInboxConversations')
  const result = await zernio.messages.listInboxConversations({
    query: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
      limit: params.limit ?? 25,
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('messages.listInboxConversations', result as never)
  const rows = Array.isArray(data.data) ? data.data
    : Array.isArray(data.conversations) ? data.conversations
      : []
  const conversations = rows
    .map(conversationOf)
    .filter((row): row is ZernioConversation => row !== null)

  // A private message is the most personal thing on this surface. The
  // `profileId` on the query above narrowed the request; this decides whose
  // conversations these are.
  if (!params.profileId) return conversations
  const allowed = await ownAccountIds(params.profileId)
  return scopeRows(conversations, allowed, (row) => row.accountId)
}

export async function fetchZernioConversationMessages(params: {
  conversationId: string
  accountId: string
  cursor?: string
  limit?: number
}): Promise<Record<string, unknown>> {
  const zernio = getZernioClient('messages.getInboxConversationMessages')
  const result = await zernio.messages.getInboxConversationMessages({
    path: { conversationId: params.conversationId },
    query: {
      accountId: params.accountId,
      ...(params.cursor ? { cursor: params.cursor } : {}),
      limit: params.limit ?? 50,
    },
  })
  return unwrapZernio<Record<string, unknown>>('messages.getInboxConversationMessages', result as never)
}

/** Send a direct message. Words to a real person — needs the gate. */
export async function sendZernioMessage(params: {
  conversationId: string
  accountId: string
  message: string
  attachmentUrl?: string
  approval: ZernioOutboundApproval
}): Promise<void> {
  const zernio = getZernioClient('messages.sendInboxMessage')
  const result = await zernio.messages.sendInboxMessage({
    path: { conversationId: params.conversationId },
    body: {
      accountId: params.accountId,
      message: params.message,
      ...(params.attachmentUrl ? { attachmentUrl: params.attachmentUrl } : {}),
    },
  })
  if (result.error) {
    throw new ZernioError('messages.sendInboxMessage', 'The message could not be sent.', {
      cause: result.error,
    })
  }
}

export async function markZernioConversationRead(params: {
  conversationId: string
  accountId: string
}): Promise<void> {
  const zernio = getZernioClient('messages.markConversationRead')
  const result = await zernio.messages.markConversationRead({
    path: { conversationId: params.conversationId },
    body: { accountId: params.accountId },
  })
  if (result.error) {
    throw new ZernioError('messages.markConversationRead', 'That conversation could not be updated.', {
      cause: result.error,
    })
  }
}

export async function setZernioConversationStatus(params: {
  conversationId: string
  accountId: string
  status: 'active' | 'archived'
}): Promise<void> {
  const zernio = getZernioClient('messages.updateInboxConversation')
  const result = await zernio.messages.updateInboxConversation({
    path: { conversationId: params.conversationId },
    body: { accountId: params.accountId, status: params.status },
  })
  if (result.error) {
    throw new ZernioError('messages.updateInboxConversation', 'That conversation could not be updated.', {
      cause: result.error,
    })
  }
}

/* ── Mentions ──────────────────────────────────────────────────────────── */

/**
 * Mentions — LinkedIn only, and label it that way.
 *
 * `platform` on the listing type is the literal `'linkedin'`, and the reply
 * operation is Instagram-only. Calling the surface "Mentions" and showing an
 * empty list to a brand whose mentions are all on Instagram would be the kind
 * of quiet lie this codebase keeps having to undo.
 */
export async function listZernioMentions(params: {
  profileId?: string
  accountId?: string
  cursor?: string
  limit?: number
  sortOrder?: 'asc' | 'desc'
}): Promise<Record<string, unknown>> {
  const zernio = getZernioClient('mentions.listInboxMentions')
  const result = await zernio.mentions.listInboxMentions({
    query: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
      ...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
      limit: params.limit ?? 25,
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('mentions.listInboxMentions', result as never)
  if (!params.profileId) return data

  const allowed = await ownAccountIds(params.profileId)
  const { payload } = scopePayloadRows(data, ['data', 'mentions'], allowed)
  return payload
}

/** Reply to a mention. Instagram only upstream. Publishing — needs the gate. */
export async function replyToZernioMention(params: {
  accountId: string
  mediaId: string
  message: string
  commentId?: string
  approval: ZernioOutboundApproval
}): Promise<void> {
  const zernio = getZernioClient('mentions.replyToMention')
  const result = await zernio.mentions.replyToMention({
    body: {
      accountId: params.accountId,
      mediaId: params.mediaId,
      message: params.message,
      ...(params.commentId ? { commentId: params.commentId } : {}),
    },
  })
  if (result.error) {
    throw new ZernioError('mentions.replyToMention', 'The reply could not be posted.', {
      cause: result.error,
    })
  }
}

/* ── Reviews ───────────────────────────────────────────────────────────── */

export async function listZernioReviews(params: {
  profileId?: string
  accountId?: string
  platform?: 'facebook' | 'googlebusiness'
  minRating?: number
  maxRating?: number
  hasReply?: boolean
  cursor?: string
  limit?: number
}): Promise<Record<string, unknown>> {
  const zernio = getZernioClient('reviews.listInboxReviews')
  const result = await zernio.reviews.listInboxReviews({
    query: {
      ...(params.profileId ? { profileId: params.profileId } : {}),
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
      ...(params.minRating !== undefined ? { minRating: params.minRating } : {}),
      ...(params.maxRating !== undefined ? { maxRating: params.maxRating } : {}),
      ...(params.hasReply !== undefined ? { hasReply: params.hasReply } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
      limit: params.limit ?? 25,
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('reviews.listInboxReviews', result as never)
  if (!params.profileId) return data

  const allowed = await ownAccountIds(params.profileId)
  const { payload, removed } = scopePayloadRows(data, ['data', 'reviews'], allowed)
  if (removed === 0) return payload

  // `summary.totalReviews` and `summary.averageRating` were computed upstream
  // over the rows we just dropped, so they describe accounts this brand does
  // not own. A star rating is a number a business owner will repeat out loud —
  // it goes rather than arrives wrong. The desk already reads a missing summary
  // as "0 / not known".
  delete payload.summary
  return payload
}

/**
 * Reply to a review.
 *
 * A Google review reply from a health brand is public advertising copy in the
 * eyes of AHPRA — testimonial rules included — so this is one of the strictest
 * gated paths in the app, not one of the loosest.
 */
export async function replyToZernioReview(params: {
  reviewId: string
  accountId: string
  message: string
  approval: ZernioOutboundApproval
}): Promise<void> {
  const zernio = getZernioClient('reviews.replyToInboxReview')
  const result = await zernio.reviews.replyToInboxReview({
    path: { reviewId: params.reviewId },
    body: { accountId: params.accountId, message: params.message },
  })
  if (result.error) {
    throw new ZernioError('reviews.replyToInboxReview', 'The reply could not be posted.', {
      cause: result.error,
    })
  }
}

export async function deleteZernioReviewReply(params: {
  reviewId: string
  accountId: string
}): Promise<void> {
  const zernio = getZernioClient('reviews.deleteInboxReviewReply')
  const result = await zernio.reviews.deleteInboxReviewReply({
    path: { reviewId: params.reviewId },
    body: { accountId: params.accountId },
  })
  if (result.error) {
    throw new ZernioError('reviews.deleteInboxReviewReply', 'That reply could not be removed.', {
      cause: result.error,
    })
  }
}
