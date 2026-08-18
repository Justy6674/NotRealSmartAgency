import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import {
  brandOwnsAccount,
  loadOutboundBrandContext,
  recordOutboundReply,
  reviewOutboundWords,
} from '@/lib/agents/tools/zernio-reply'
import { listZernioReviews, replyToZernioReview } from '@/lib/zernio/engagement'
import type { DeskReview } from '@/components/agency/inbox/types'

export const dynamic = 'force-dynamic'

/**
 * Customer reviews, and the replies that go under them.
 *
 * ── The strictest reply surface in the app ─────────────────────────────
 * A reply under a Google or Facebook review from a clinic is public advertising
 * in the eyes of AHPRA — including the testimonial rules, which is the part
 * people are surprised by. "Thanks Sarah, so glad the injections worked for
 * you" is a testimonial about a regulated service published by the practice
 * itself. So this goes through exactly the same review as a paid ad.
 *
 * ── Empty is not broken ────────────────────────────────────────────────
 * The live account answers this call successfully with no reviews at all. The
 * response therefore separates "we read your accounts and there is nothing" from
 * "we could not read them", because a health brand acting on the wrong one of
 * those is how a bad review sits unanswered for a month.
 */

const NOT_SIGNED_IN = 'You are not signed in, so nothing could be read. Sign in and try again.'
const NOT_YOURS = 'That business could not be opened under this sign-in.'
const NEEDS_BRAND = 'Choose a business first — reviews are kept per business.'
const NOT_LINKED = 'This business has no connected accounts yet, so there is nothing to show.'
const UNREACHABLE =
  'Reviews could not be read just now. Nothing has been changed — try again in a moment.'

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function deskReviewOf(raw: unknown): DeskReview | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const id = str(rec.id) ?? str(rec._id) ?? str(rec.reviewId)
  if (!id) return null
  const reviewer = (rec.reviewer ?? rec.author ?? {}) as Record<string, unknown>
  const reply = rec.reply && typeof rec.reply === 'object'
    ? str((rec.reply as Record<string, unknown>).comment) ??
      str((rec.reply as Record<string, unknown>).message)
    : str(rec.reply) ?? str(rec.replyComment)
  const rating = typeof rec.rating === 'number'
    ? rec.rating
    : typeof rec.starRating === 'number'
      ? rec.starRating
      : null
  return {
    id,
    authorName: str(rec.authorName) ?? str(reviewer.displayName) ?? str(reviewer.name),
    rating,
    comment: str(rec.comment) ?? str(rec.text) ?? str(rec.content) ?? '',
    createdAt: str(rec.createdAt) ?? str(rec.createTime) ?? str(rec.createdTime),
    accountId: str(rec.accountId),
    platform: str(rec.platform),
    reply,
    url: str(rec.url) ?? str(rec.permalink),
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
      return NextResponse.json({ configured: false, reviews: [], problem: NOT_LINKED })
    }

    const raw = await listZernioReviews({ profileId, limit: 25 })
    const rows = Array.isArray(raw.data) ? raw.data : Array.isArray(raw.reviews) ? raw.reviews : []
    const meta = (raw.meta ?? {}) as Record<string, unknown>
    const summary = (raw.summary ?? {}) as Record<string, unknown>

    return NextResponse.json({
      configured: true,
      reviews: rows.flatMap((row) => {
        const review = deskReviewOf(row)
        return review ? [review] : []
      }),
      totalReviews: typeof summary.totalReviews === 'number' ? summary.totalReviews : 0,
      averageRating: typeof summary.averageRating === 'number' ? summary.averageRating : null,
      // Greater than zero means the list is incomplete, which is a different
      // thing from being short.
      unreadableAccounts: typeof meta.accountsFailed === 'number' ? meta.accountsFailed : 0,
    })
  } catch (err) {
    return NextResponse.json({
      configured: true,
      reviews: [],
      problem: userSafeError('api/social/reviews GET', err, UNREACHABLE),
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
    const reviewId = typeof body.reviewId === 'string' ? body.reviewId : null
    const accountId = typeof body.accountId === 'string' ? body.accountId : null
    const message = typeof body.message === 'string' ? body.message : ''

    if (!brandId) return NextResponse.json({ error: NEEDS_BRAND }, { status: 400 })
    if (!reviewId || !accountId) {
      return NextResponse.json({ error: 'That review could not be identified.' }, { status: 400 })
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
      label: 'a public reply to a customer review',
    })
    if (!review.allowed) {
      return NextResponse.json({ ok: false, blocked: true, reason: review.reason }, { status: 422 })
    }

    await replyToZernioReview({
      reviewId,
      accountId,
      message: message.trim(),
      approval: review.approval,
    })

    await recordOutboundReply(supabase, {
      userId: user.id,
      brandId,
      content: message.trim(),
      title: 'Reply to a review',
      metadata: { zernio_review_id: reviewId, zernio_account_id: accountId },
    })

    return NextResponse.json({ ok: true, warnings: review.warnings })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: userSafeError(
          'api/social/reviews POST',
          err,
          'The reply could not be sent just now. Nothing was sent — try again in a moment.',
        ),
      },
      { status: 500 },
    )
  }
}
