import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  listZernioCommentedPosts,
  listZernioConversations,
  listZernioMentions,
  listZernioReviews,
} from './engagement.ts'
import {
  fetchZernioAnalyticsReport,
  fetchZernioBestTimeToPost,
  fetchZernioContentDecay,
  fetchZernioInboxVolume,
  fetchZernioPostingFrequency,
  fetchZernioResponseTime,
} from './insights.ts'

/**
 * A Zernio read must never be the thing that decides whose data this is.
 *
 * `account-scoping.test.ts` pins that rule for `client.ts` — accounts, posts and
 * ad campaigns. It stopped there, and the two files holding every OTHER read
 * went unguarded: comments, conversations, mentions, reviews, the analytics
 * report, best time, content decay, posting frequency, response time and inbox
 * volume all put `profileId` on the query and returned the answer verbatim.
 * `listAccounts({ profileId })` was measured on 2026-08-17 to accept that same
 * argument and ignore it, so "we asked for one profile" is not evidence of
 * anything. On these two files it meant one customer's comments, private
 * messages and Google reviews could reach another customer's desk.
 *
 * Worse than unfiltered was the one filter that existed:
 *
 *   posts.filter((post) => !post.accountId || allowed.has(post.accountId))
 *
 * `!post.accountId ||` KEPT every row whose account id did not resolve — and
 * `fetchZernioAccounts` returns `[]` on ANY failure, a rotated key included. So
 * the morning after a key rotation the allowed set is empty, every attributable
 * row is dropped, and the only rows left standing are the ones nobody could
 * attribute. The exact inversion of what a health brand needs.
 *
 * These tests run the real code against a stubbed `fetch` — `@zernio/node` goes
 * through the global, so one stub covers every endpoint — because the source
 * assertions at the bottom of this file can only prove a shape, not a decision.
 */

const realFetch = globalThis.fetch
const realKey = process.env.ZERNIO_API_KEY

/** The brand under test owns exactly this account. */
const OURS = 'acc-ours'
const THEIRS = 'acc-theirs'
const PROFILE = 'profile-a'

function urlOf(input: unknown): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  if (input instanceof Request) return input.url
  return String(input)
}

interface StubBodies {
  /** Omit to give this brand one account; pass `[]` for the key-rotation case. */
  accounts?: unknown[]
  comments?: unknown
  conversations?: unknown
  mentions?: unknown
  reviews?: unknown
  analytics?: unknown
  bestTime?: unknown
  contentDecay?: unknown
  postingFrequency?: unknown
  responseTime?: unknown
  volume?: unknown
}

const ONE_OWN_ACCOUNT = [{ _id: OURS, platform: 'facebook', profileId: { _id: PROFILE, name: 'A' } }]

/**
 * Route by path, most specific first — `/v1/analytics/inbox/volume` must not be
 * answered by the bare `/v1/analytics` branch.
 */
function stubZernio(bodies: StubBodies) {
  globalThis.fetch = (async (input: unknown) => {
    const path = new URL(urlOf(input)).pathname
    if (path === '/api/v1/accounts') {
      return Response.json({ accounts: bodies.accounts ?? ONE_OWN_ACCOUNT })
    }
    if (path.startsWith('/api/v1/inbox/comments')) return Response.json(bodies.comments ?? {})
    if (path.startsWith('/api/v1/inbox/conversations')) return Response.json(bodies.conversations ?? {})
    if (path.startsWith('/api/v1/inbox/mentions')) return Response.json(bodies.mentions ?? {})
    if (path.startsWith('/api/v1/inbox/reviews')) return Response.json(bodies.reviews ?? {})
    if (path.startsWith('/api/v1/analytics/inbox/response-time')) {
      return Response.json(bodies.responseTime ?? {})
    }
    if (path.startsWith('/api/v1/analytics/inbox/volume')) return Response.json(bodies.volume ?? {})
    if (path.startsWith('/api/v1/analytics/best-time')) return Response.json(bodies.bestTime ?? {})
    if (path.startsWith('/api/v1/analytics/content-decay')) return Response.json(bodies.contentDecay ?? {})
    if (path.startsWith('/api/v1/analytics/posting-frequency')) {
      return Response.json(bodies.postingFrequency ?? {})
    }
    if (path === '/api/v1/analytics') return Response.json(bodies.analytics ?? {})
    throw new Error(`unstubbed publisher path: ${path}`)
  }) as typeof fetch
}

beforeEach(() => {
  process.env.ZERNIO_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = realFetch
  if (realKey === undefined) delete process.env.ZERNIO_API_KEY
  else process.env.ZERNIO_API_KEY = realKey
})

/* ── Rows that belong to somebody, and rows that belong to nobody ──────── */

test('comments: another account\'s row and an unattributable row are both dropped', async () => {
  stubZernio({
    comments: {
      data: [
        { _id: 'p-ours', platform: 'facebook', accountId: OURS, commentCount: 3 },
        { _id: 'p-theirs', platform: 'facebook', accountId: THEIRS, commentCount: 9 },
        { _id: 'p-orphan', platform: 'facebook', commentCount: 1 },
      ],
    },
  })

  const page = await listZernioCommentedPosts({ profileId: PROFILE })

  assert.deepEqual(page.posts.map((post) => post.id), ['p-ours'])
})

test('comments: a populated account reference is read, not compared as an object', async () => {
  // `accountId` arrives as `{_id, name}` on some endpoints. Comparing the raw
  // field to a string matches nothing and silently empties the desk.
  stubZernio({
    comments: { data: [{ _id: 'p-ours', platform: 'facebook', accountId: { _id: OURS, name: 'Page' } }] },
  })

  const page = await listZernioCommentedPosts({ profileId: PROFILE })

  assert.deepEqual(page.posts.map((post) => post.id), ['p-ours'])
})

test('comments: when the account list cannot be read, NOTHING survives', async () => {
  // fetchZernioAccounts returns [] on any failure — a rotated key, a 5xx, a
  // timeout. The old filter kept precisely the unattributable rows in that
  // state. This is the assertion that must never be relaxed.
  stubZernio({
    accounts: [],
    comments: {
      data: [
        { _id: 'p-ours', platform: 'facebook', accountId: OURS },
        { _id: 'p-orphan', platform: 'facebook' },
      ],
    },
  })

  const page = await listZernioCommentedPosts({ profileId: PROFILE })

  assert.deepEqual(page.posts, [], 'an empty allowed set must mean an empty desk, not an orphan desk')
})

test('conversations: private messages are scoped to this brand\'s own accounts', async () => {
  stubZernio({
    conversations: {
      data: [
        { _id: 'c-ours', platform: 'instagram', accountId: OURS, unreadCount: 2 },
        { _id: 'c-theirs', platform: 'instagram', accountId: THEIRS, unreadCount: 7 },
        { _id: 'c-orphan', platform: 'instagram' },
      ],
    },
  })

  const conversations = await listZernioConversations({ profileId: PROFILE })

  assert.deepEqual(conversations.map((row) => row.id), ['c-ours'])
})

test('mentions: the relayed envelope carries only our rows', async () => {
  stubZernio({
    mentions: {
      data: [
        { id: 'm-ours', platform: 'linkedin', accountId: OURS },
        { id: 'm-theirs', platform: 'linkedin', accountId: THEIRS },
        { id: 'm-orphan', platform: 'linkedin' },
      ],
      pagination: { hasMore: false },
    },
  })

  const raw = await listZernioMentions({ profileId: PROFILE })
  const rows = raw.data as Record<string, unknown>[]

  assert.deepEqual(rows.map((row) => row.id), ['m-ours'])
  assert.deepEqual(raw.pagination, { hasMore: false }, 'only the rows are touched')
})

test('reviews: foreign rows go, and the star average computed over them goes with them', async () => {
  stubZernio({
    reviews: {
      data: [
        { id: 'r-ours', platform: 'googlebusiness', accountId: OURS, rating: 5 },
        { id: 'r-theirs', platform: 'googlebusiness', accountId: THEIRS, rating: 1 },
      ],
      summary: { totalReviews: 2, averageRating: 3 },
    },
  })

  const raw = await listZernioReviews({ profileId: PROFILE })
  const rows = raw.data as Record<string, unknown>[]

  assert.deepEqual(rows.map((row) => row.id), ['r-ours'])
  assert.equal(
    raw.summary,
    undefined,
    'a rating averaged over another business\'s reviews is a number the owner would repeat out loud',
  )
})

test('reviews: an untouched listing keeps its summary', async () => {
  stubZernio({
    reviews: {
      data: [{ id: 'r-ours', platform: 'googlebusiness', accountId: OURS, rating: 5 }],
      summary: { totalReviews: 1, averageRating: 5 },
    },
  })

  const raw = await listZernioReviews({ profileId: PROFILE })

  assert.deepEqual(raw.summary, { totalReviews: 1, averageRating: 5 })
})

/* ── Analytics ─────────────────────────────────────────────────────────── */

test('the analytics report keeps only posts published by an account we own', async () => {
  stubZernio({
    analytics: {
      overview: { totalPosts: 3, publishedPosts: 3, scheduledPosts: 0 },
      posts: [
        {
          _id: 'post-ours',
          content: 'ours',
          platforms: [{ platform: 'facebook', accountId: { _id: OURS, name: 'Page' } }],
        },
        {
          _id: 'post-theirs',
          content: 'theirs',
          platforms: [{ platform: 'facebook', accountId: THEIRS }],
          // Zernio's own word for whose post this is. Deliberately not trusted.
          profileId: PROFILE,
        },
        { _id: 'post-orphan', content: 'orphan' },
      ],
    },
  })

  const report = await fetchZernioAnalyticsReport({ profileId: PROFILE })

  assert.deepEqual(report.posts.map((post) => post.id), ['post-ours'])
  assert.equal(
    report.overview.totalPosts,
    undefined,
    'a total counted over rows we just removed describes accounts this brand does not own',
  )
})

test('an untouched analytics report still reports its counts', async () => {
  stubZernio({
    analytics: {
      overview: { totalPosts: 1, publishedPosts: 1, scheduledPosts: 0 },
      posts: [{ _id: 'post-ours', content: 'ours', platforms: [{ platform: 'facebook', accountId: OURS }] }],
    },
  })

  const report = await fetchZernioAnalyticsReport({ profileId: PROFILE })

  assert.deepEqual(report.posts.map((post) => post.id), ['post-ours'])
  assert.equal(report.overview.totalPosts, 1)
})

test('a named account that is not ours is refused before the numbers are read', async () => {
  stubZernio({
    bestTime: { slots: [{ day_of_week: 1, hour: 9, avg_engagement: 40, post_count: 12 }] },
    contentDecay: { buckets: [{ bucket_label: '0-6h', avg_pct_of_final: 60, post_count: 12 }] },
    postingFrequency: { frequency: [{ platform: 'facebook', posts_per_week: 4 }] },
    responseTime: { summary: { sampleSize: 40, medianSeconds: 120, p90Seconds: 300 } },
    volume: { summary: { received: 90, sent: 88 } },
    analytics: { posts: [{ _id: 'post-theirs', platforms: [{ accountId: THEIRS }] }] },
  })

  const named = { profileId: PROFILE, accountId: THEIRS }

  assert.deepEqual(await fetchZernioBestTimeToPost(named), [])
  assert.deepEqual(await fetchZernioContentDecay(named), [])
  assert.deepEqual(await fetchZernioPostingFrequency(named), [])
  assert.deepEqual(await fetchZernioInboxVolume({ ...named, fromDate: '2026-01-01' }), {})
  assert.deepEqual((await fetchZernioAnalyticsReport(named)).posts, [])

  const timing = await fetchZernioResponseTime({ ...named, fromDate: '2026-01-01' })
  assert.equal(timing.sampleSize, 0, 'no sample is the honest answer; the desk renders it as no figure')
})

test('a brand whose accounts cannot be read is shown no aggregate at all', async () => {
  stubZernio({
    accounts: [],
    bestTime: { slots: [{ day_of_week: 1, hour: 9, avg_engagement: 40, post_count: 12 }] },
    responseTime: { summary: { sampleSize: 40, medianSeconds: 120, p90Seconds: 300 } },
  })

  assert.deepEqual(await fetchZernioBestTimeToPost({ profileId: PROFILE }), [])
  const timing = await fetchZernioResponseTime({ profileId: PROFILE, fromDate: '2026-01-01' })
  assert.equal(timing.sampleSize, 0)
})

test('scoping does not blank the reports it was added to protect', async () => {
  // The failure mode on the other side: over-blocking leaves ten report
  // components rendering nothing, which is the fault this file's subject was
  // written to fix in the first place.
  stubZernio({
    bestTime: { slots: [{ day_of_week: 1, hour: 9, avg_engagement: 40, post_count: 12 }] },
    contentDecay: { buckets: [{ bucket_label: '0-6h', bucket_order: 1, avg_pct_of_final: 60, post_count: 12 }] },
    postingFrequency: { frequency: [{ platform: 'facebook', posts_per_week: 4, weeks_count: 6 }] },
    responseTime: { summary: { sampleSize: 40, medianSeconds: 120, p90Seconds: 300 }, histogram: [{ bucket: '0-1m', count: 3 }] },
    volume: { summary: { received: 90, sent: 88 }, byPlatform: [{ platform: 'facebook', received: 90 }] },
  })

  const scoped = { profileId: PROFILE, accountId: OURS }

  assert.equal((await fetchZernioBestTimeToPost(scoped)).length, 1)
  assert.equal((await fetchZernioContentDecay(scoped)).length, 1)
  assert.equal((await fetchZernioPostingFrequency(scoped)).length, 1)

  const timing = await fetchZernioResponseTime({ ...scoped, fromDate: '2026-01-01' })
  assert.equal(timing.sampleSize, 40)
  assert.equal(timing.histogram.length, 1)

  const volume = await fetchZernioInboxVolume({ ...scoped, fromDate: '2026-01-01' })
  assert.deepEqual(volume.summary, { received: 90, sent: 88 })
})

/* ── Source guardrails, over the whole directory ───────────────────────── */

const DIR = join(process.cwd(), 'src/lib/zernio')

function sourceFiles(): { name: string; code: string }[] {
  return readdirSync(DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({
      name,
      // Comments in these files quote the very expressions under test, so prose
      // would otherwise be read as code.
      code: readFileSync(join(DIR, name), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^[ \t]*\/\/.*$/gm, ''),
    }))
}

test('no read in this directory keeps a row whose account id did not resolve', () => {
  // `!post.accountId || allowed.has(post.accountId)` is the shape that shipped.
  // It reads as caution and behaves as the opposite.
  const failOpen = /!\s*[\w.]*\.?accountId\s*\|\|/
  for (const file of sourceFiles()) {
    assert.doesNotMatch(
      file.code,
      failOpen,
      `${file.name} keeps rows it could not attribute — an unattributable row is excluded, never kept`,
    )
  }
})

test('every profile-scoped read decides ownership from our own account list', () => {
  // Each of these takes a profileId, hands it to Zernio, and must then check the
  // answer against fetchZernioAccounts rather than trusting the filter.
  const scopedReads: Record<string, string[]> = {
    'engagement.ts': [
      'listZernioCommentedPosts',
      'listZernioConversations',
      'listZernioMentions',
      'listZernioReviews',
    ],
    'insights.ts': [
      'fetchZernioAnalyticsReport',
      'fetchZernioBestTimeToPost',
      'fetchZernioContentDecay',
      'fetchZernioPostingFrequency',
      'fetchZernioResponseTime',
      'fetchZernioInboxVolume',
    ],
  }
  // The two entry points that call fetchZernioAccounts; nothing else may decide.
  const gate = /(ownAccountIds|resolveReadScope)\(/

  for (const [name, functions] of Object.entries(scopedReads)) {
    const code = readFileSync(join(DIR, name), 'utf8')
    for (const fn of functions) {
      const start = code.indexOf(`export async function ${fn}(`)
      assert.ok(start > -1, `${name} no longer exports ${fn} — update this guardrail deliberately`)
      const next = code.indexOf('\nexport ', start + 1)
      const body = code.slice(start, next === -1 ? undefined : next)
      assert.match(
        body,
        gate,
        `${fn} returns Zernio's answer verbatim — a Zernio call must never decide whose data this is`,
      )
    }
  }

  for (const name of Object.keys(scopedReads)) {
    assert.match(
      readFileSync(join(DIR, name), 'utf8'),
      /fetchZernioAccounts\(/,
      `${name} must resolve ownership from our own account list`,
    )
  }
})

test('every raw publisher fetch in this directory is guarded by the content-type check', () => {
  // html-guard.test.ts makes this claim but reads client.ts alone. A wrong path
  // answers 200 text/html, so one unguarded fetch anywhere in here is one silent
  // empty screen — the guard is only worth anything if it is on every call.
  let totalFetches = 0
  for (const file of sourceFiles()) {
    const fetches = (file.code.match(/await fetch\(/g) ?? []).length
    const guards = (file.code.match(/assertZernioJson\(/g) ?? []).length
    totalFetches += fetches
    assert.ok(
      guards >= fetches,
      `${file.name}: ${fetches} raw publisher fetches but only ${guards} content-type guards`,
    )
  }
  assert.ok(totalFetches > 0, 'expected at least one raw fetch in this directory to guard')
})

test('the "could not be read" count counts our accounts only', async () => {
  stubZernio({
    comments: {
      data: [{ _id: 'p-ours', platform: 'facebook', accountId: OURS }],
      meta: {
        failedAccounts: [
          { accountId: OURS, error: 'Token expired' },
          { accountId: THEIRS, error: 'Token expired' },
        ],
      },
    },
  })

  const page = await listZernioCommentedPosts({ profileId: PROFILE })

  assert.deepEqual(page.failedAccounts.map((row) => row.accountId), [OURS])
})
