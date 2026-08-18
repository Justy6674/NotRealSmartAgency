import type { DeskPostStatus } from '@/hooks/usePostsList'

/**
 * What a post on the desk IS, derived in one place.
 *
 * ── Why this file exists ───────────────────────────────────────────────
 * "Waiting on you" meant two different things at once, on the same screen.
 *
 *   the sidebar badge : `status IN ('draft','failed')` — 68 for Scent Sell
 *   the Posts tab     : an assistant wrote it and the owner has not said yes
 *                       — 17 for Scent Sell, from the same 121 rows
 *
 * So the sidebar promised sixty-eight things to review, the tab beside it
 * offered seventeen, and the screen behind the sidebar row showed sixty-eight
 * again. Every one of those numbers was computed by a different piece of code
 * that had never been introduced to the others. A count the owner cannot trust
 * is worse than no count: he stops reading the badge, and then he stops
 * clearing the queue.
 *
 * There is now ONE derivation and one predicate, and every count is taken from
 * them. If a screen wants a different number it has to change this file, which
 * makes the disagreement impossible rather than merely unlikely.
 *
 * Pure and dependency-free on purpose — the API routes, the client hooks and
 * the review screen all read it, so it must not reach for Supabase, `next/*`
 * or anything server-only.
 */

/**
 * The sources that mean "something other than the owner wrote this".
 *
 * A draft the owner typed himself is not waiting on him — he is the one who
 * stopped typing. A draft an assistant produced is sitting in front of him
 * asking a question, and that is the whole of the approval queue.
 */
export const ASSISTANT_SOURCES: ReadonlySet<string> = new Set([
  'ai_generate',
  'fill_calendar',
  'director_chat',
  'publish_to_social',
  'mcp_external',
  'canva_import',
  'team_member',
])

/** The least a row has to carry for the derivation to work on it. */
export interface DeskStatusRow {
  status?: unknown
  metadata?: unknown
}

/**
 * The owner-facing state of one `scheduled_posts` row.
 *
 * Six of the eight words come straight off the column. `needs_approval` is
 * ours and is derived here; `partial` belongs to published history and is
 * decided elsewhere, because no row of ours can be in it.
 *
 * ── Why this is idempotent, and must stay so ──────────────────────────────
 * The derived word does not stay on the server. `/api/scheduled-posts` puts it
 * in the `status` field of every row it sends, so by the time a screen holds a
 * row, `status` is already the ANSWER rather than the column. Running the
 * derivation again on such a row has to give the same answer.
 *
 * It did not. `needs_approval` was not one of the words this function
 * recognised, so a row that had already been judged fell through to the
 * bottom and came back `draft` — and the Review screen, which filters the
 * API's own rows with `isWaitingOnYou`, threw away every card it had just been
 * given. The sidebar said seventeen were waiting and the screen it opened was
 * empty, which is worse than the wrong number it replaced: a badge you can
 * click and find nothing behind teaches you to stop clicking it.
 */
export function deskStatusOfDeskRow(row: DeskStatusRow): DeskPostStatus {
  const status = String(row.status ?? 'draft')
  // Already judged — by us, on the way out of the API. Judging it twice must
  // not change the answer.
  if (status === 'needs_approval') return 'needs_approval'
  if (status === 'draft') {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    const source = typeof meta.source === 'string' ? meta.source : 'unknown'
    if (ASSISTANT_SOURCES.has(source) && meta.approved_at === undefined) return 'needs_approval'
    return 'draft'
  }
  if (
    status === 'scheduled' ||
    status === 'publishing' ||
    status === 'published' ||
    status === 'failed' ||
    status === 'cancelled'
  ) {
    return status
  }
  return 'draft'
}

/**
 * THE definition of "Waiting on you". Nothing may re-state it.
 *
 * Note what is deliberately NOT in here: `failed`. A post that did not go out
 * is a failure, not a decision — it has its own tab ("Did not go out") and its
 * own colour, and folding it into the approval queue is how the badge came to
 * claim sixty-eight approvals when seventeen were being asked for.
 */
export function isWaitingOnYou(row: DeskStatusRow): boolean {
  return deskStatusOfDeskRow(row) === 'needs_approval'
}

/** How many of these rows are waiting on a decision from the owner. */
export function countWaitingOnYou(rows: readonly DeskStatusRow[]): number {
  return rows.reduce((total, row) => (isWaitingOnYou(row) ? total + 1 : total), 0)
}

/**
 * Whether a row counts as one of the owner's posts at all.
 *
 * `cancelled` is this product's soft delete — the "Deleted" tab, the bin. It
 * is not a post any more. The Posts badge said 121 while the All tab it sits
 * beside showed about 70, because 51 of those rows were things the owner had
 * already thrown away. A delete button that leaves the number where it was is
 * a delete button people stop believing.
 */
export function isLivePost(row: DeskStatusRow): boolean {
  return deskStatusOfDeskRow(row) !== 'cancelled'
}

/** How many posts this business actually has — the number beside "All". */
export function countLivePosts(rows: readonly DeskStatusRow[]): number {
  return rows.reduce((total, row) => (isLivePost(row) ? total + 1 : total), 0)
}
