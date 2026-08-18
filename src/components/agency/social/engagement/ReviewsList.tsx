'use client'

import { useState } from 'react'
import { ExternalLink, Loader2, Star } from 'lucide-react'
import { replyToReview, useReviews } from '@/hooks/useEngagement'
import { relativeTime } from '@/components/agency/inbox/types'
import { ReplyBox } from './ConversationThread'

/**
 * Customer reviews, and the replies that go under them.
 *
 * ── The one people get wrong ───────────────────────────────────────────
 * A reply under a review, from a business that advertises a regulated health
 * service, is advertising — testimonial rules included. "So glad it worked for
 * you, Sarah" published by the practice is a testimonial about a regulated
 * service, whoever typed it. So a reply here goes through exactly the same
 * review as a paid ad, and the desk says so above the box rather than letting
 * anyone find out afterwards.
 *
 * An empty list here is genuinely empty — the read succeeds and returns nothing
 * — which is why "no reviews" and "could not read your reviews" are two
 * different sentences below.
 */

const INK = 'var(--ink, oklch(0.20 0.014 240))'
const INK_3 = 'var(--ink-3, oklch(0.615 0.011 240))'
const LINE = 'var(--line, oklch(0.915 0.007 240))'
const CARE = 'var(--care, oklch(0.52 0.150 25))'

function Stars({ rating }: { rating: number | null }) {
  if (rating === null) return null
  return (
    <span className="flex items-center gap-[1px]" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          className="h-3 w-3"
          style={{
            color: value <= rating ? 'oklch(0.72 0.15 70)' : 'var(--line, oklch(0.915 0.007 240))',
            fill: value <= rating ? 'oklch(0.72 0.15 70)' : 'transparent',
          }}
        />
      ))}
    </span>
  )
}

export function ReviewsList({ brandId }: { brandId: string }) {
  const { reviews, averageRating, unreadableAccounts, problem, loading, refresh } =
    useReviews(brandId)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  return (
    <div className="space-y-3 p-4">
      {averageRating !== null ? (
        <p className="text-[12.5px]" style={{ color: INK_3 }}>
          Average rating {averageRating.toFixed(1)} out of 5 across {reviews.length}{' '}
          {reviews.length === 1 ? 'review' : 'reviews'}.
        </p>
      ) : null}

      {unreadableAccounts > 0 ? (
        <p className="text-[12px]" style={{ color: CARE }}>
          {unreadableAccounts === 1
            ? 'One of your accounts could not be read this time, so this list may be short.'
            : `${unreadableAccounts} of your accounts could not be read this time, so this list may be short.`}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: INK_3 }} />
          <span className="text-[12.5px]" style={{ color: INK_3 }}>Reading your reviews…</span>
        </div>
      ) : problem ? (
        <p className="text-[12.5px]" style={{ color: INK_3 }}>{problem}</p>
      ) : reviews.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: INK_3 }}>
          We looked, and nobody has left a review yet. When one arrives it lands here.
        </p>
      ) : (
        reviews.map((review) => (
          <div key={review.id} className="rounded-[8px] border px-4 py-3" style={{ borderColor: LINE }}>
            <div className="flex items-baseline gap-2">
              <span className="text-[12.5px] font-[600]" style={{ color: INK }}>
                {review.authorName ?? 'Someone'}
              </span>
              <Stars rating={review.rating} />
              {review.createdAt ? (
                <span className="text-[11px]" style={{ color: INK_3 }}>
                  {relativeTime(review.createdAt)}
                </span>
              ) : null}
              {review.url ? (
                <a
                  href={review.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto flex items-center gap-1 text-[11.5px]"
                  style={{ color: INK_3 }}
                >
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
              ) : null}
            </div>

            <p className="mt-1 text-[13px]" style={{ color: INK }}>{review.comment || '—'}</p>

            {review.reply ? (
              <div
                className="mt-2 rounded-[6px] px-3 py-2 text-[12.5px]"
                style={{ background: 'var(--brand-wash, oklch(0.966 0.0068 240))', color: INK }}
              >
                <span className="font-[600]">Your reply:</span> {review.reply}
              </div>
            ) : review.accountId ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setReplyingTo(replyingTo === review.id ? null : review.id)}
                  className="rounded-[5px] border px-2 py-1 text-[11.5px]"
                  style={{ borderColor: LINE, color: INK_3 }}
                >
                  Reply
                </button>
                {replyingTo === review.id ? (
                  <div className="mt-2">
                    <ReplyBox
                      placeholder="Write your reply…"
                      hint="A reply under a review is public advertising. It is checked against this business’s advertising rules — including the rules on testimonials — before it goes out."
                      send={(message) =>
                        replyToReview({
                          brandId,
                          reviewId: review.id,
                          accountId: review.accountId as string,
                          message,
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
            ) : (
              <p className="mt-2 text-[11.5px]" style={{ color: INK_3 }}>
                This one has to be answered on the channel itself.
              </p>
            )}
          </div>
        ))
      )}
    </div>
  )
}
