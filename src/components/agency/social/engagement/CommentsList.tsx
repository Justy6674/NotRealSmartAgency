'use client'

import { useState } from 'react'
import { EyeOff, Eye, Loader2, MessageSquare, Trash2, Mail } from 'lucide-react'
import {
  moderateComment,
  replyToComment,
  useCommentedPosts,
  useComments,
  type CommentedPost,
} from '@/hooks/useEngagement'
import { relativeTime } from '@/components/agency/inbox/types'
import { ReplyBox } from './ConversationThread'

/**
 * Comments under this business's own posts — the surface with the sharpest
 * regulatory edge on the whole desk.
 *
 * For a clinic, a comment claiming a cure sits under the clinic's own
 * advertising and is the clinic's problem, not the commenter's. Until now
 * nothing in this app could even SEE one. So this screen leads with the count
 * waiting, offers the two lawful fast responses — hide it, or answer it — and
 * sends every answer through the advertising review first.
 *
 * Hiding sends no words of ours anywhere, so it needs no review and is often
 * the fastest correct move. Answering does, and cannot skip it.
 */

const INK = 'var(--ink, oklch(0.20 0.014 240))'
const INK_3 = 'var(--ink-3, oklch(0.615 0.011 240))'
const LINE = 'var(--line, oklch(0.915 0.007 240))'
const BRAND_WASH = 'var(--brand-wash, oklch(0.966 0.0068 240))'

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'X',
  bluesky: 'Bluesky',
  threads: 'Threads',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  metaads: 'An ad',
}

function channel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform.charAt(0).toUpperCase() + platform.slice(1)
}

function CommentThread({ brandId, post }: { brandId: string; post: CommentedPost }) {
  const { comments, loading, problem, refresh } = useComments(brandId, post)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [privately, setPrivately] = useState(false)

  const moderate = async (commentId: string, action: 'hide' | 'unhide' | 'delete') => {
    setBusyId(commentId)
    await moderateComment({
      brandId,
      postId: post.id,
      accountId: post.accountId,
      commentId,
      action,
    })
    setBusyId(null)
    void refresh()
  }

  if (loading) {
    return (
      <p className="px-4 py-3 text-[12.5px]" style={{ color: INK_3 }}>
        Reading the comments…
      </p>
    )
  }

  if (problem) {
    return <p className="px-4 py-3 text-[12.5px]" style={{ color: INK_3 }}>{problem}</p>
  }

  if (comments.length === 0) {
    return (
      <p className="px-4 py-3 text-[12.5px]" style={{ color: INK_3 }}>
        Nothing has been said under this post yet.
      </p>
    )
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {comments.map((comment) => (
        <div key={comment.id} className="rounded-[6px] border px-3 py-2" style={{ borderColor: LINE }}>
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-[600]" style={{ color: INK }}>
              {comment.authorName ?? 'Someone'}
            </span>
            {comment.createdAt ? (
              <span className="text-[11px]" style={{ color: INK_3 }}>
                {relativeTime(comment.createdAt)}
              </span>
            ) : null}
            {comment.hidden ? (
              <span className="text-[11px]" style={{ color: 'var(--care, oklch(0.52 0.150 25))' }}>
                Hidden
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[13px]" style={{ color: INK }}>{comment.message || '—'}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setReplyingTo(replyingTo === comment.id ? null : comment.id); setPrivately(false) }}
              className="flex items-center gap-1 rounded-[5px] border px-2 py-1 text-[11.5px]"
              style={{ borderColor: LINE, color: INK_3 }}
            >
              <MessageSquare className="h-3 w-3" /> Reply
            </button>
            <button
              type="button"
              onClick={() => { setReplyingTo(comment.id); setPrivately(true) }}
              className="flex items-center gap-1 rounded-[5px] border px-2 py-1 text-[11.5px]"
              style={{ borderColor: LINE, color: INK_3 }}
            >
              <Mail className="h-3 w-3" /> Reply privately
            </button>
            <button
              type="button"
              onClick={() => moderate(comment.id, comment.hidden ? 'unhide' : 'hide')}
              disabled={busyId === comment.id}
              className="flex items-center gap-1 rounded-[5px] border px-2 py-1 text-[11.5px] disabled:opacity-40"
              style={{ borderColor: LINE, color: INK_3 }}
            >
              {busyId === comment.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : comment.hidden ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
              {comment.hidden ? 'Show again' : 'Hide'}
            </button>
            <button
              type="button"
              onClick={() => moderate(comment.id, 'delete')}
              disabled={busyId === comment.id}
              className="flex items-center gap-1 rounded-[5px] border px-2 py-1 text-[11.5px] disabled:opacity-40"
              style={{ borderColor: LINE, color: INK_3 }}
            >
              <Trash2 className="h-3 w-3" /> Remove
            </button>
          </div>

          {replyingTo === comment.id ? (
            <div className="mt-2">
              <ReplyBox
                placeholder={privately ? 'Send this privately…' : 'Write your reply…'}
                hint={
                  privately
                    ? 'This goes to them as a private message, and is checked against this business’s advertising rules first.'
                    : 'This appears publicly under your post, and is checked against this business’s advertising rules first.'
                }
                send={(message) =>
                  replyToComment({
                    brandId,
                    postId: post.id,
                    accountId: post.accountId,
                    commentId: comment.id,
                    message,
                    privately,
                  })
                }
                onSent={() => {
                  setReplyingTo(null)
                  void refresh()
                }}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function CommentsList({ brandId }: { brandId: string }) {
  const { posts, problem, configured, unreadableAccounts, loading } = useCommentedPosts(brandId)
  const [openId, setOpenId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: INK_3 }} />
        <span className="text-[12.5px]" style={{ color: INK_3 }}>Looking for new comments…</span>
      </div>
    )
  }

  if (!configured || problem) {
    return (
      <p className="p-4 text-[12.5px]" style={{ color: INK_3 }}>
        {problem ?? 'This business has no connected accounts yet, so there are no comments to show.'}
      </p>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {unreadableAccounts > 0 ? (
        // "No comments" and "we could not look at two of your accounts" are
        // different sentences, and only one is safe to act on.
        <p className="text-[12px]" style={{ color: 'var(--care, oklch(0.52 0.150 25))' }}>
          {unreadableAccounts === 1
            ? 'One of your accounts could not be read this time, so this list may be short.'
            : `${unreadableAccounts} of your accounts could not be read this time, so this list may be short.`}
        </p>
      ) : null}

      {posts.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: INK_3 }}>
          No comments on your posts yet. When somebody comments, it lands here.
        </p>
      ) : (
        posts.map((post) => {
          const open = openId === post.id
          return (
            <div key={post.id} className="rounded-[8px] border" style={{ borderColor: LINE }}>
              <button
                type="button"
                onClick={() => setOpenId(open ? null : post.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
                style={{ background: open ? BRAND_WASH : 'transparent' }}
              >
                {post.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.picture} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded"
                    style={{ background: 'var(--line-soft, oklch(0.950 0.005 240))' }}
                  >
                    <MessageSquare className="h-4 w-4" style={{ color: INK_3 }} />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]" style={{ color: INK }}>
                    {post.content || '(no caption)'}
                  </span>
                  <span className="mt-1 block text-[11.5px]" style={{ color: INK_3 }}>
                    {channel(post.platform)}
                    {post.accountUsername ? ` · ${post.accountUsername}` : ''}
                    {post.createdTime ? ` · ${relativeTime(post.createdTime)}` : ''}
                    {post.isAd ? ' · under an ad' : ''}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-[700] tabular-nums" style={{ color: INK }}>
                    {post.commentCount}
                  </span>
                  <span className="block text-[10.5px]" style={{ color: INK_3 }}>
                    {post.commentCount === 1 ? 'comment' : 'comments'}
                  </span>
                </span>
              </button>
              {open ? <CommentThread brandId={brandId} post={post} /> : null}
            </div>
          )
        })
      )}
    </div>
  )
}
