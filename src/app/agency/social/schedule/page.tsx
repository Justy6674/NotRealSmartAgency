'use client'

export const dynamic = 'force-dynamic'

import { PostingSchedulePage } from '@/components/agency/studio/posting-schedule/PostingSchedulePage'
import { useAgencyStore } from '@/stores/agency-store'

/**
 * Posting times.
 *
 * The department shell already supplies the scrolling, padded pane (18/26/26)
 * — it is the only scroller in Social. Wrapping this screen in a second
 * `overflow-y-auto` gave it two scrollbars and doubled the side padding.
 *
 * ── Why this is one component again ────────────────────────────────────
 * It used to be the grid plus a second component underneath carrying the
 * best-times panel and the clear control, remounted by a `generation` counter
 * whenever one of them wrote. Two components reading the same schedule down two
 * separate fetches meant they could disagree about the week — which is exactly
 * the confusion a screen about "when do we post" cannot afford — and the counter
 * was a remount papering over it. Both of those jobs now live inside the screen
 * that owns the week, reading it once, so there is one answer on the page.
 *
 * Keyed on the business so switching brands starts from that brand's own week
 * rather than briefly showing the previous one's.
 */
export default function SocialSchedulePage() {
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)

  return <PostingSchedulePage key={activeBrandId ?? 'none'} />
}
