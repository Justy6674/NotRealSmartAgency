'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  DeskComment,
  DeskMention,
  DeskMessage,
  DeskReview,
  InboxItem,
  InboxResponse,
} from '@/components/agency/inbox/types'

// Re-exported because the desk components import these from the hook they use.
// The declarations themselves live in `inbox/types.ts`, shared with the routes.
export type { DeskComment, DeskMention, DeskMessage, DeskReview }

/**
 * Everything the Engagement desk reads and sends.
 *
 * ── One rule shapes every function here ────────────────────────────────
 * Nothing in this file talks to a social network. Every send goes to our own
 * route, which runs the brand's advertising review before a single word leaves,
 * and the browser is told plainly when a reply was refused. A component that
 * could post directly would be a way around that review, so none of them can.
 *
 * ── Refused is not failed ──────────────────────────────────────────────
 * A refusal comes back as `blocked` with a reason written for the owner. The
 * desk shows it as an answer — "this cannot go out, here is why" — not as an
 * error, because the review working correctly is not a fault.
 */

export interface SendResult {
  ok: boolean
  /** True when the review refused the words. `reason` explains it plainly. */
  blocked?: boolean
  reason?: string
}

async function send(url: string, body: Record<string, unknown>): Promise<SendResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.ok && data.ok !== false) return { ok: true }
    if (res.status === 422 && typeof data.reason === 'string') {
      return { ok: false, blocked: true, reason: data.reason }
    }
    return {
      ok: false,
      reason:
        typeof data.error === 'string'
          ? data.error
          : 'That could not be sent just now. Nothing was sent — try again in a moment.',
    }
  } catch {
    return {
      ok: false,
      reason: 'That could not be sent just now. Nothing was sent — try again in a moment.',
    }
  }
}

/* ── Comments ──────────────────────────────────────────────────────────── */

export interface CommentedPost {
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
  isAd: boolean
}

export function useCommentedPosts(brandId: string | null) {
  const [posts, setPosts] = useState<CommentedPost[]>([])
  const [problem, setProblem] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)
  const [unreadableAccounts, setUnreadableAccounts] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/social/comments?brandId=${brandId}`)
      const data = (await res.json()) as Record<string, unknown>
      setPosts(Array.isArray(data.posts) ? (data.posts as CommentedPost[]) : [])
      setProblem(typeof data.problem === 'string' ? data.problem : null)
      setConfigured(data.configured !== false)
      setUnreadableAccounts(
        typeof data.unreadableAccounts === 'number' ? data.unreadableAccounts : 0,
      )
    } catch {
      setProblem('Comments could not be read just now. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => { void load() }, [load])

  return { posts, problem, configured, unreadableAccounts, loading, refresh: load }
}

export function useComments(brandId: string | null, post: CommentedPost | null) {
  const [comments, setComments] = useState<DeskComment[]>([])
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!brandId || !post) {
      setComments([])
      return
    }
    setLoading(true)
    setProblem(null)
    try {
      const params = new URLSearchParams({
        brandId,
        postId: post.id,
        accountId: post.accountId,
      })
      const res = await fetch(`/api/social/comments?${params.toString()}`)
      const data = (await res.json()) as Record<string, unknown>
      setComments(Array.isArray(data.comments) ? (data.comments as DeskComment[]) : [])
      if (typeof data.problem === 'string') setProblem(data.problem)
    } catch {
      setProblem('Those comments could not be read just now. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [brandId, post])

  useEffect(() => { void load() }, [load])

  return { comments, loading, problem, refresh: load }
}

export function replyToComment(params: {
  brandId: string
  postId: string
  accountId: string
  message: string
  commentId?: string
  privately?: boolean
}): Promise<SendResult> {
  return send('/api/social/comments', {
    brandId: params.brandId,
    action: params.privately ? 'private_reply' : 'reply',
    postId: params.postId,
    accountId: params.accountId,
    commentId: params.commentId,
    message: params.message,
  })
}

export function moderateComment(params: {
  brandId: string
  postId: string
  accountId: string
  commentId: string
  action: 'hide' | 'unhide' | 'delete'
}): Promise<SendResult> {
  return send('/api/social/comments', params)
}

/* ── Conversations ─────────────────────────────────────────────────────── */

export function useConversations(brandId: string | null) {
  const [items, setItems] = useState<InboxItem[]>([])
  const [unavailable, setUnavailable] = useState<InboxResponse['unavailable']>(null)
  // 'brand' is the only honest default: the route never answers with anything
  // wider than one business's own accounts, so an unreadable response must not
  // leave the desk believing it is looking at the whole workspace.
  const [scope, setScope] = useState<InboxResponse['scope']>('brand')
  const [accountsFailed, setAccountsFailed] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    // No business, no request. The desk mounts this hook before it can render
    // its "choose a business" state, so a null brand used to reach the route
    // as a query with no brandId at all — which is precisely the shape that
    // asked for every connected account in the workspace. Messages are read
    // for one business or not at all.
    if (!brandId) {
      setItems([])
      setUnavailable(null)
      setScope('brand')
      setAccountsFailed(0)
      setProblem(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/inbox?brandId=${encodeURIComponent(brandId)}`)
      const data = (await res.json()) as InboxResponse
      setItems(data.items ?? [])
      setUnavailable(data.unavailable ?? null)
      setScope(data.scope ?? 'brand')
      setAccountsFailed(data.accountsFailed ?? 0)
      setProblem(data.error ?? null)
    } catch {
      setProblem('Your messages could not be read just now. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => { void load() }, [load])

  return { items, unavailable, scope, accountsFailed, problem, loading, refresh: load }
}

export function useConversationMessages(brandId: string | null, item: InboxItem | null) {
  const [messages, setMessages] = useState<DeskMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const load = useCallback(async () => {
    // A thread is read under the business that owns the account, or not at
    // all: the route checks that this business owns the account id before it
    // opens anything, and it cannot do that without being told which business.
    if (!item || !brandId) {
      setMessages([])
      return
    }
    setLoading(true)
    setProblem(null)
    try {
      const params = new URLSearchParams({
        brandId,
        conversationId: item.id,
        accountId: item.accountId,
      })
      const res = await fetch(`/api/inbox?${params.toString()}`)
      const data = (await res.json()) as Record<string, unknown>
      setMessages(Array.isArray(data.messages) ? (data.messages as DeskMessage[]) : [])
      // A refusal (this business does not own that account) comes back as an
      // error with no messages. Saying so beats an empty pane that reads as
      // "nothing was ever said here".
      if (!res.ok && typeof data.error === 'string') setProblem(data.error)
    } catch {
      setProblem('That conversation could not be opened just now. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [brandId, item])

  useEffect(() => { void load() }, [load])

  return { messages, loading, problem, refresh: load }
}

export function replyToConversation(params: {
  brandId: string
  conversationId: string
  accountId: string
  message: string
}): Promise<SendResult> {
  return send('/api/inbox', { ...params, action: 'reply' })
}

export function updateConversation(params: {
  brandId: string
  conversationId: string
  accountId: string
  action: 'mark_read' | 'archive' | 'unarchive'
}): Promise<SendResult> {
  return send('/api/inbox', params)
}

/* ── Mentions ──────────────────────────────────────────────────────────── */

export function useMentions(brandId: string | null) {
  const [mentions, setMentions] = useState<DeskMention[]>([])
  const [coverage, setCoverage] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/social/mentions?brandId=${brandId}`)
      const data = (await res.json()) as Record<string, unknown>
      setMentions(Array.isArray(data.mentions) ? (data.mentions as DeskMention[]) : [])
      setCoverage(typeof data.coverage === 'string' ? data.coverage : null)
      setProblem(typeof data.problem === 'string' ? data.problem : null)
    } catch {
      setProblem('Mentions could not be read just now. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => { void load() }, [load])

  return { mentions, coverage, problem, loading, refresh: load }
}

export function replyToMention(params: {
  brandId: string
  accountId: string
  mediaId: string
  message: string
  commentId?: string
}): Promise<SendResult> {
  return send('/api/social/mentions', params)
}

/* ── Reviews ───────────────────────────────────────────────────────────── */

export function useReviews(brandId: string | null) {
  const [reviews, setReviews] = useState<DeskReview[]>([])
  const [averageRating, setAverageRating] = useState<number | null>(null)
  const [unreadableAccounts, setUnreadableAccounts] = useState(0)
  const [problem, setProblem] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/social/reviews?brandId=${brandId}`)
      const data = (await res.json()) as Record<string, unknown>
      setReviews(Array.isArray(data.reviews) ? (data.reviews as DeskReview[]) : [])
      setAverageRating(typeof data.averageRating === 'number' ? data.averageRating : null)
      setUnreadableAccounts(
        typeof data.unreadableAccounts === 'number' ? data.unreadableAccounts : 0,
      )
      setProblem(typeof data.problem === 'string' ? data.problem : null)
    } catch {
      setProblem('Reviews could not be read just now. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => { void load() }, [load])

  return { reviews, averageRating, unreadableAccounts, problem, loading, refresh: load }
}

export function replyToReview(params: {
  brandId: string
  reviewId: string
  accountId: string
  message: string
}): Promise<SendResult> {
  return send('/api/social/reviews', params)
}
