import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import {
  brandOwnsAccount,
  loadOutboundBrandContext,
  recordOutboundReply,
  reviewOutboundWords,
} from '@/lib/agents/tools/zernio-reply'
import { listZernioMentions, replyToZernioMention } from '@/lib/zernio/engagement'
import type { DeskMention } from '@/components/agency/inbox/types'

export const dynamic = 'force-dynamic'

/**
 * Where the brand has been named by somebody else.
 *
 * ── Say what this actually covers ──────────────────────────────────────
 * The listing upstream is LinkedIn-only: `platform` on those rows is typed as
 * the literal string, and the reply operation is Instagram-only. Presenting
 * this as "Mentions" full stop, and then showing an empty list to a brand whose
 * mentions are all on Instagram, would be the quiet kind of lie this codebase
 * keeps having to undo. So the response says which network it read, and the
 * desk prints that sentence.
 *
 * A reply to a mention is public copy from the brand and passes the same
 * regulatory review as a post.
 */

const NOT_SIGNED_IN = 'You are not signed in, so nothing could be read. Sign in and try again.'
const NOT_YOURS = 'That business could not be opened under this sign-in.'
const NEEDS_BRAND = 'Choose a business first — mentions are kept per business.'
const NOT_LINKED = 'This business has no connected accounts yet, so there is nothing to show.'
const UNREACHABLE =
  'Mentions could not be read just now. Nothing has been changed — try again in a moment.'

/** The only network this listing covers today, in the owner's words. */
const COVERAGE = 'LinkedIn only for now — other networks do not share their mentions with us yet.'

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function deskMentionOf(raw: unknown): DeskMention | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const id = str(rec.id) ?? str(rec._id)
  if (!id) return null
  const author = (rec.author ?? rec.from ?? {}) as Record<string, unknown>
  return {
    id,
    authorName: str(rec.authorName) ?? str(author.name) ?? str(author.username),
    message: str(rec.text) ?? str(rec.content) ?? str(rec.message) ?? '',
    createdAt: str(rec.createdAt) ?? str(rec.createdTime) ?? str(rec.timestamp),
    url: str(rec.url) ?? str(rec.permalink),
    accountId: str(rec.accountId),
    mediaId: str(rec.mediaId) ?? str(rec.postId),
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const brandId = new URL(request.url).searchParams.get('brandId')
    if (!brandId) return NextResponse.json({ error: NEEDS_BRAND }, { status: 400 })

    const access = await loadOutboundBrandContext(supabase, user.id, brandId)
    if (access.access === 'denied') return NextResponse.json({ error: NOT_YOURS }, { status: 403 })

    const profileId = access.brand.profileId
    if (!profileId || !process.env.ZERNIO_API_KEY) {
      return NextResponse.json({ configured: false, mentions: [], coverage: COVERAGE, problem: NOT_LINKED })
    }

    const raw = await listZernioMentions({ profileId, sortOrder: 'desc', limit: 25 })
    const rows = Array.isArray(raw.data)
      ? raw.data
      : Array.isArray(raw.mentions)
        ? raw.mentions
        : []

    return NextResponse.json({
      configured: true,
      coverage: COVERAGE,
      mentions: rows.flatMap((row) => {
        const mention = deskMentionOf(row)
        return mention ? [mention] : []
      }),
    })
  } catch (err) {
    return NextResponse.json({
      configured: true,
      mentions: [],
      coverage: COVERAGE,
      problem: userSafeError('api/social/mentions GET', err, UNREACHABLE),
    })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const brandId = typeof body.brandId === 'string' ? body.brandId : null
    const accountId = typeof body.accountId === 'string' ? body.accountId : null
    const mediaId = typeof body.mediaId === 'string' ? body.mediaId : null
    const commentId = typeof body.commentId === 'string' ? body.commentId : undefined
    const message = typeof body.message === 'string' ? body.message : ''

    if (!brandId) return NextResponse.json({ error: NEEDS_BRAND }, { status: 400 })
    if (!accountId || !mediaId) {
      return NextResponse.json(
        { error: 'That mention cannot be answered from here.' },
        { status: 400 },
      )
    }

    const access = await loadOutboundBrandContext(supabase, user.id, brandId)
    if (access.access === 'denied') return NextResponse.json({ error: NOT_YOURS }, { status: 403 })

    const profileId = access.brand.profileId
    if (!profileId || !(await brandOwnsAccount(profileId, accountId))) {
      return NextResponse.json({ error: NOT_YOURS }, { status: 403 })
    }

    const review = await reviewOutboundWords({
      content: message,
      brand: access.brand,
      label: 'a reply to a mention',
    })
    if (!review.allowed) {
      return NextResponse.json({ ok: false, blocked: true, reason: review.reason }, { status: 422 })
    }

    await replyToZernioMention({
      accountId,
      mediaId,
      message: message.trim(),
      ...(commentId ? { commentId } : {}),
      approval: review.approval,
    })

    await recordOutboundReply(supabase, {
      userId: user.id,
      brandId,
      content: message.trim(),
      title: 'Reply to a mention',
      metadata: { zernio_media_id: mediaId, zernio_account_id: accountId },
    })

    return NextResponse.json({ ok: true, warnings: review.warnings })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: userSafeError(
          'api/social/mentions POST',
          err,
          'The reply could not be sent just now. Nothing was sent — try again in a moment.',
        ),
      },
      { status: 500 },
    )
  }
}
