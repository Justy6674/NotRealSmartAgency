import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import {
  brandOwnsAccount,
  loadOutboundBrandContext,
  recordOutboundReply,
  reviewOutboundWords,
} from '@/lib/agents/tools/zernio-reply'
import {
  deleteZernioComment,
  fetchZernioPostComments,
  listZernioCommentedPosts,
  replyToZernioPost,
  sendZernioPrivateReply,
  setZernioCommentHidden,
  type ZernioCommentPlatform,
} from '@/lib/zernio/engagement'
import type { DeskComment } from '@/components/agency/inbox/types'

export const dynamic = 'force-dynamic'

/**
 * Comments under this brand's posts, and the replies that go back.
 *
 * ── Why this route exists at all ───────────────────────────────────────
 * Four brands advertise regulated health services, and until now NRS could not
 * SEE a comment on one of their posts — thirteen comment operations existed
 * upstream and none were reachable. An unmoderated comment claiming a cure sits
 * under a clinic's own advertising and is the clinic's exposure, not the
 * commenter's. Being able to read them is the point; being able to answer them
 * safely is the rest of it.
 *
 * ── Every outbound word is publishing ──────────────────────────────────
 * A public reply, and a private reply that opens a DM, both reach a real person
 * as the brand. Both pass the shared regulatory review in
 * `lib/agents/tools/zernio-reply.ts` before anything is sent, and the reply
 * wrappers physically cannot be called without the proof it produces.
 *
 * Hiding and deleting a comment send no words of ours anywhere, so they take no
 * review — and for a regulated brand, hiding a comment that makes a therapeutic
 * claim is often the fastest lawful response available.
 */

const NOT_SIGNED_IN = 'You are not signed in, so nothing could be read. Sign in and try again.'
const NOT_YOURS = 'That business could not be opened under this sign-in.'
const NEEDS_BRAND = 'Choose a business first — comments are kept per business.'
const NOT_LINKED =
  'This business has no connected accounts yet, so there are no comments to show.'
const UNREACHABLE =
  'Comments could not be read just now. Nothing has been changed — try again in a moment.'

const PLATFORMS: ZernioCommentPlatform[] = [
  'facebook', 'instagram', 'twitter', 'bluesky', 'threads',
  'youtube', 'linkedin', 'reddit', 'metaads',
]

function isPlatform(value: string | null): value is ZernioCommentPlatform {
  return !!value && (PLATFORMS as string[]).includes(value)
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Comment rows differ per network — Facebook nests the author under `from`,
 * Instagram sends `username` flat, YouTube sends neither — so every field is
 * read defensively and a missing author prints as "Someone" rather than "@".
 */
function deskCommentOf(raw: unknown): DeskComment | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const id = str(rec.id) ?? str(rec._id) ?? str(rec.commentId)
  if (!id) return null
  const from = (rec.from ?? rec.author ?? {}) as Record<string, unknown>
  return {
    id,
    authorName:
      str(rec.authorName) ?? str(rec.username) ?? str(from.name) ?? str(from.username),
    message: str(rec.message) ?? str(rec.text) ?? str(rec.content) ?? '',
    createdAt: str(rec.createdTime) ?? str(rec.createdAt) ?? str(rec.timestamp),
    likeCount: num(rec.likeCount ?? rec.likes),
    replyCount: num(rec.commentCount ?? rec.replyCount),
    hidden: rec.isHidden === true || rec.hidden === true,
    fromUs: rec.isFromAccount === true || rec.fromAccount === true || rec.isOwner === true,
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const brandId = searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: NEEDS_BRAND }, { status: 400 })

    const access = await loadOutboundBrandContext(supabase, user.id, brandId)
    if (access.access === 'denied') return NextResponse.json({ error: NOT_YOURS }, { status: 403 })

    const profileId = access.brand.profileId
    if (!profileId || !process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ configured: false, posts: [], problem: NOT_LINKED })
    }

    const postId = searchParams.get('postId')
    const accountId = searchParams.get('accountId')

    // One post's comments.
    if (postId && accountId) {
      if (!(await brandOwnsAccount(profileId, accountId))) {
        return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
      }
      const commentId = searchParams.get('commentId') ?? undefined
      const raw = await fetchZernioPostComments({
        postId,
        accountId,
        ...(commentId ? { commentId } : {}),
        limit: 50,
      })
      const rows = Array.isArray(raw.comments)
        ? raw.comments
        : Array.isArray(raw.data)
          ? raw.data
          : []
      return NextResponse.json({
        configured: true,
        comments: rows.flatMap((row) => {
          const comment = deskCommentOf(row)
          return comment ? [comment] : []
        }),
      })
    }

    // The posts that have comments waiting.
    const platform = searchParams.get('platform')
    const page = await listZernioCommentedPosts({
      profileId,
      ...(isPlatform(platform) ? { platform } : {}),
      sortBy: 'date',
      sortOrder: 'desc',
      limit: 25,
    })

    return NextResponse.json({
      configured: true,
      posts: page.posts,
      // "No comments" and "we could not look at three of your accounts" are
      // different sentences, and only one of them is safe to show.
      unreadableAccounts: page.failedAccounts.length,
    })
  } catch (err) {
    return NextResponse.json(
      { configured: true, posts: [], problem: userSafeError('api/social/comments GET', err, UNREACHABLE) },
      { status: 200 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const brandId = typeof body.brandId === 'string' ? body.brandId : null
    const action = typeof body.action === 'string' ? body.action : 'reply'
    const postId = typeof body.postId === 'string' ? body.postId : null
    const accountId = typeof body.accountId === 'string' ? body.accountId : null
    const commentId = typeof body.commentId === 'string' ? body.commentId : undefined
    const message = typeof body.message === 'string' ? body.message : ''

    if (!brandId) return NextResponse.json({ error: NEEDS_BRAND }, { status: 400 })
    if (!postId || !accountId) {
      return NextResponse.json({ error: 'That comment could not be identified.' }, { status: 400 })
    }

    const access = await loadOutboundBrandContext(supabase, user.id, brandId)
    if (access.access === 'denied') return NextResponse.json({ error: NOT_YOURS }, { status: 403 })

    const profileId = access.brand.profileId
    if (!profileId || !(await brandOwnsAccount(profileId, accountId))) {
      return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
    }

    // Moderation first: no words of ours leave, so no review applies.
    if (action === 'hide' || action === 'unhide') {
      if (!commentId) {
        return NextResponse.json({ error: 'That comment could not be identified.' }, { status: 400 })
      }
      await setZernioCommentHidden({ postId, commentId, accountId, hidden: action === 'hide' })
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete') {
      if (!commentId) {
        return NextResponse.json({ error: 'That comment could not be identified.' }, { status: 400 })
      }
      await deleteZernioComment({ postId, commentId, accountId })
      return NextResponse.json({ ok: true })
    }

    // Everything below sends words to a real audience.
    const isPrivate = action === 'private_reply'
    const review = await reviewOutboundWords({
      content: message,
      brand: access.brand,
      label: isPrivate ? 'a private reply to a comment' : 'a public reply to a comment',
    })

    if (!review.allowed) {
      // 422, not 500: the request was understood and deliberately refused. The
      // reason is written for the owner by the gate itself.
      return NextResponse.json({ ok: false, blocked: true, reason: review.reason }, { status: 422 })
    }

    if (isPrivate) {
      if (!commentId) {
        return NextResponse.json({ error: 'That comment could not be identified.' }, { status: 400 })
      }
      // Quick-reply chips do not render in the folder a cold private message
      // lands in, so nothing here relies on them.
      await sendZernioPrivateReply({
        postId,
        commentId,
        accountId,
        message: message.trim(),
        approval: review.approval,
      })
    } else {
      await replyToZernioPost({
        postId,
        accountId,
        message: message.trim(),
        ...(commentId ? { commentId } : {}),
        approval: review.approval,
      })
    }

    await recordOutboundReply(supabase, {
      userId: user.id,
      brandId,
      content: message.trim(),
      title: isPrivate ? 'Private reply to a comment' : 'Reply to a comment',
      metadata: {
        zernio_post_id: postId,
        zernio_comment_id: commentId ?? null,
        zernio_account_id: accountId,
        private: isPrivate,
      },
    })

    return NextResponse.json({ ok: true, warnings: review.warnings })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: userSafeError(
          'api/social/comments POST',
          err,
          'The reply could not be sent just now. Nothing was sent — try again in a moment.',
        ),
      },
      { status: 500 },
    )
  }
}
