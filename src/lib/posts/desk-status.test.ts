import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  countLivePosts,
  countWaitingOnYou,
  deskStatusOfDeskRow,
  isWaitingOnYou,
} from './desk-status.ts'
import type { DeskPostStatus } from '../../hooks/usePostsList.ts'

/**
 * A number on the glass is a promise about the screen behind it.
 *
 * Two of them were lying at once, on the same sidebar, about the same 121 rows
 * of one live business (Scent Sell, measured 2026-08-18):
 *
 *   "Waiting on you 68"  — `status IN ('draft','failed')` in the nav-counts
 *                          route. The Posts tab beside it said 17, derived
 *                          from "an assistant wrote this and nobody has
 *                          approved it", and the review screen the badge opens
 *                          showed 68 cards. Three numbers, one label.
 *   "Posts 121"          — every `scheduled_posts` row, beside a list showing
 *                          about 70, because 51 of them were `cancelled` —
 *                          posts the owner had already deleted.
 *
 * Neither is a counting bug. Both are two pieces of code answering the same
 * question in private. So this file does not check arithmetic; it checks that
 * there is only ever one answer:
 *
 *   1. behaviour — for a fixture carrying deleted rows and assistant-written
 *      rows, the sidebar's number equals the screen's number, exactly.
 *   2. source    — nobody has quietly grown a second definition. A count that
 *      is right today and privately derived is the same bug waiting again.
 */

const repo = process.cwd()
const read = (path: string) => readFileSync(join(repo, path), 'utf8')

const NAV_COUNTS = 'src/app/api/social/nav-counts/route.ts'
const SCHEDULED_POSTS = 'src/app/api/scheduled-posts/route.ts'
const REVIEW_ROOM = 'src/components/agency/studio/ReviewRoom.tsx'
const POSTS_LIST_HOOK = 'src/hooks/usePostsList.ts'
const SHELL_LAYOUT = 'src/app/agency/layout.tsx'

/* ── The fixture ─────────────────────────────────────────────────────────── */

interface Row {
  id: string
  status: string
  metadata: Record<string, unknown>
}

const row = (id: string, status: string, metadata: Record<string, unknown> = {}): Row => ({
  id,
  status,
  metadata,
})

/**
 * Shaped like the live business, smaller: deleted rows in the majority of the
 * drafts, assistant drafts mixed in with the owner's own, one already approved,
 * and failures present so the "Waiting on you" definition has something to
 * wrongly swallow if it ever reverts.
 */
const FIXTURE: Row[] = [
  // Waiting on you — an assistant wrote it, the owner has not said yes.
  row('a1', 'draft', { source: 'ai_generate' }),
  row('a2', 'draft', { source: 'fill_calendar' }),
  row('a3', 'draft', { source: 'director_chat' }),
  row('a4', 'draft', { source: 'mcp_external' }),

  // Not waiting: the owner wrote these himself, so nothing is being asked.
  row('o1', 'draft', { source: 'manual' }),
  row('o2', 'draft', {}),

  // Not waiting: an assistant wrote it and the owner already approved it.
  row('p1', 'draft', { source: 'ai_generate', approved_at: '2026-08-18T04:00:00Z' }),

  // Deleted. The bin. Not a post any more — including one an assistant wrote,
  // which must not creep back into the approval queue by the side door.
  row('d1', 'cancelled', {}),
  row('d2', 'cancelled', { source: 'ai_generate' }),
  row('d3', 'cancelled', { source: 'fill_calendar' }),

  // Everything else the desk can hold.
  row('s1', 'scheduled', { source: 'ai_generate' }),
  row('u1', 'publishing', {}),
  row('g1', 'published', {}),
  row('f1', 'failed', { source: 'ai_generate' }),
  row('f2', 'failed', {}),
]

/* ── What each surface shows ─────────────────────────────────────────────── */

/**
 * The sidebar and the department tab strip, as `/api/social/nav-counts` builds
 * them: both numbers taken from the shared functions, from one read of the rows.
 */
function sidebarNumbers(rows: Row[]) {
  return {
    /** The "Waiting on you" badge under Social media. */
    waitingOnYou: countWaitingOnYou(rows),
    /** The quiet count on the department's "Posts" tab. */
    posts: countLivePosts(rows),
  }
}

/**
 * The Posts screen, as it actually assembles its tab counts: the API stamps a
 * derived status on every row (`deskRowToSocialPost` → `deskStatusOfDeskRow`),
 * then `usePostsList` tallies those words — `allCount` skipping the bin,
 * `statusCounts` keyed by the derived status.
 *
 * The two rules this mirrors are pinned against the hook's source below, so the
 * mirror cannot go stale without a test going red.
 */
function screenNumbers(rows: Row[]) {
  const derived: DeskPostStatus[] = rows.map((r) => deskStatusOfDeskRow(r))
  return {
    /** The "Waiting on you" tab on the Posts list. */
    waitingOnYou: derived.filter((status) => status === 'needs_approval').length,
    /** The "All" tab on the Posts list. */
    posts: derived.filter((status) => status !== 'cancelled').length,
  }
}

/* ── 1. The badge and the screen agree ───────────────────────────────────── */

test('the sidebar number is the number the screen shows', () => {
  const sidebar = sidebarNumbers(FIXTURE)
  const screen = screenNumbers(FIXTURE)

  assert.equal(
    sidebar.waitingOnYou,
    screen.waitingOnYou,
    'the "Waiting on you" badge must equal the "Waiting on you" tab',
  )
  assert.equal(
    sidebar.posts,
    screen.posts,
    'the "Posts" badge must equal the "All" tab it sits beside',
  )

  // Stated outright so a change of meaning has to be argued for, not absorbed.
  assert.equal(sidebar.waitingOnYou, 4, 'four assistant drafts are awaiting a yes')
  assert.equal(sidebar.posts, 12, 'fifteen rows, three of them deleted')
})

test('deleted posts are not counted as posts', () => {
  const deleted = FIXTURE.filter((r) => r.status === 'cancelled')
  assert.ok(deleted.length > 0, 'the fixture must carry deleted rows')

  const withBin = countLivePosts(FIXTURE)
  const withoutBin = countLivePosts(FIXTURE.filter((r) => r.status !== 'cancelled'))
  assert.equal(withBin, withoutBin, 'emptying the bin must not change the number')
  assert.equal(withBin, FIXTURE.length - deleted.length)
})

test('a deleted assistant draft is not waiting on anybody', () => {
  assert.equal(isWaitingOnYou(row('x', 'cancelled', { source: 'ai_generate' })), false)
})

test('"waiting on you" is an approval, never a failure', () => {
  // The count this replaced was `status IN ('draft','failed')`, which is how a
  // badge came to promise 68 approvals on a desk with 17.
  assert.equal(isWaitingOnYou(row('x', 'failed', { source: 'ai_generate' })), false)
  assert.equal(isWaitingOnYou(row('x', 'failed', {})), false)
  assert.equal(deskStatusOfDeskRow(row('x', 'failed', {})), 'failed')
})

test('a draft the owner wrote is not waiting on the owner', () => {
  assert.equal(isWaitingOnYou(row('x', 'draft', { source: 'manual' })), false)
  assert.equal(isWaitingOnYou(row('x', 'draft', {})), false)
  assert.equal(isWaitingOnYou(row('x', 'draft', { source: 'ai_generate' })), true)
})

test('an approved assistant draft leaves the queue', () => {
  const pending = row('x', 'draft', { source: 'director_chat' })
  assert.equal(isWaitingOnYou(pending), true)
  assert.equal(
    isWaitingOnYou(row('x', 'draft', { source: 'director_chat', approved_at: '2026-08-18T00:00:00Z' })),
    false,
  )
})

/* ── 2. There is only one definition ─────────────────────────────────────── */

test('nav-counts derives both numbers from the shared definition', () => {
  const source = read(NAV_COUNTS)

  assert.match(
    source,
    /from '@\/lib\/posts\/desk-status'/,
    'nav-counts must import the shared derivation',
  )
  assert.match(source, /countWaitingOnYou/, 'the badge must use the shared predicate')
  assert.match(source, /countLivePosts/, 'the posts badge must exclude the bin')

  // The two shapes of the old bug, spelled out so a revert is loud.
  assert.ok(
    !/WAITING_STATUSES/.test(source),
    'nav-counts must not keep its own list of "waiting" statuses',
  )
  assert.ok(
    !/\.in\('status'/.test(source),
    'a status list in the query is a second definition of what is waiting',
  )
})

test('the sidebar first paint counts the same queue as the badge that replaces it', () => {
  // The shell paints a number server-side, then `/api/social/nav-counts`
  // replaces it a moment later. Two definitions here meant the badge changed
  // under the owner's eye — 68, then 17 — which is how a number stops being
  // something anyone acts on.
  const source = read(SHELL_LAYOUT)
  assert.match(source, /countWaitingOnYou/, 'the first paint must use the shared predicate')
  assert.ok(
    !/\['draft', 'failed'\]/.test(source),
    'the layout must not keep its own idea of what is waiting',
  )
})

test('the scheduled-posts route imports the derivation rather than restating it', () => {
  const source = read(SCHEDULED_POSTS)
  assert.match(
    source,
    /import \{ deskStatusOfDeskRow \} from '@\/lib\/posts\/desk-status'/,
    'the desk route must import the derivation',
  )
  assert.ok(
    !/function deskStatusOfDeskRow/.test(source),
    'the derivation must exist in exactly one file',
  )
})

test('the review screen shows the queue the badge promises', () => {
  const source = read(REVIEW_ROOM)
  assert.match(
    source,
    /isWaitingOnYou/,
    'the screen behind "Waiting on you" must use the same predicate as the badge',
  )
  assert.ok(
    !/status=draft,failed/.test(source),
    'asking for draft+failed is the 68-versus-17 bug, restored',
  )
})

test('the Posts list still counts "All" as everything but the bin', () => {
  // `screenNumbers` above mirrors these two rules. If the hook changes how it
  // tallies, this fails first and the mirror gets fixed with it.
  const source = read(POSTS_LIST_HOOK)
  assert.match(
    source,
    /allPosts\.filter\(\(post\) => post\.status !== 'cancelled'\)\.length/,
    'allCount must be every row except the bin',
  )
  assert.match(
    source,
    /if \(p\.status in counts\) counts\[p\.status\]\+\+/,
    'statusCounts must tally the derived status word',
  )
})

test('ASSISTANT_SOURCES is declared once in the whole tree', () => {
  const declarations = [
    NAV_COUNTS,
    SCHEDULED_POSTS,
    REVIEW_ROOM,
    SHELL_LAYOUT,
    'src/lib/posts/desk-status.ts',
  ]
    .filter((path) => /const ASSISTANT_SOURCES/.test(read(path)))
  assert.deepEqual(
    declarations,
    ['src/lib/posts/desk-status.ts'],
    'only the shared module may say which sources mean "an assistant wrote this"',
  )
})

/**
 * The one the source-scan above could not catch.
 *
 * `ReviewRoom` filters rows that came back from `/api/scheduled-posts`, and
 * that route has ALREADY replaced `status` with the derived word. So the
 * predicate runs a second time, on its own output. It used to answer
 * differently the second time — `needs_approval` was not a word the derivation
 * recognised, so every card the screen had just been handed was thrown away and
 * the badge opened onto nothing.
 *
 * Using the shared predicate is not enough; it has to survive the round trip.
 */
test('a row judged on the way out is still judged the same on the way in', () => {
  const overTheWire = (r: Row) => ({ ...r, status: deskStatusOfDeskRow(r) })

  for (const original of FIXTURE) {
    const sent = overTheWire(original)
    assert.equal(
      deskStatusOfDeskRow(sent),
      deskStatusOfDeskRow(original),
      `row ${original.id}: the derivation changed its mind when re-run on its own answer`,
    )
    assert.equal(
      isWaitingOnYou(sent),
      isWaitingOnYou(original),
      `row ${original.id}: the approval queue changed size crossing the wire`,
    )
  }

  // And the number the Review screen renders is the number on the badge.
  const asTheApiSendsThem = FIXTURE.filter((r) => r.status === 'draft').map(overTheWire)
  assert.equal(
    asTheApiSendsThem.filter(isWaitingOnYou).length,
    countWaitingOnYou(FIXTURE),
    'the review screen must render exactly as many cards as the badge counted',
  )
})
