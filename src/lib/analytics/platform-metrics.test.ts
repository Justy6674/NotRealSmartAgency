import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  RESULTS_NOT_COLLECTED,
  fetchPlatformMetrics,
  selectAccountForReport,
} from './platform-metrics'

/**
 * Guardrails for the one thing this file is not allowed to do: report a failed
 * read, or an unmeasured business, as a measurement.
 *
 * Twelve of the fourteen businesses fell through to a publisher endpoint that
 * 404s on every platform. The failure was returned as an ordinary empty
 * measurement and the screen drew it as "nothing is connected" — to a health
 * brand with accounts connected and posts published. These tests fail if that
 * shape can come back.
 */

const SOURCE = readFileSync(join(process.cwd(), 'src/lib/analytics/platform-metrics.ts'), 'utf8')

test('a brand with no results profile is told results are not collected, not that it is empty', async () => {
  const metrics = await fetchPlatformMetrics({
    brandId: 'b1',
    platform: 'facebook',
    from: '2026-07-01',
    to: '2026-07-31',
    socialUrls: { website: 'https://example.com.au' },
  })

  assert.equal(metrics.notCollected, RESULTS_NOT_COLLECTED)
  // Not a failure — there is nothing to retry.
  assert.equal(metrics.problem, undefined)
  assert.equal(metrics.empty, true)
  assert.deepEqual(metrics.totals, {})
  assert.deepEqual(metrics.topPosts, [])
})

test('a brand with a profile but no key is told the same, never a bare empty', async () => {
  const key = process.env.ZERNIO_API_KEY
  delete process.env.ZERNIO_API_KEY
  try {
    const metrics = await fetchPlatformMetrics({
      brandId: 'b1',
      platform: 'instagram',
      from: '2026-07-01',
      to: '2026-07-31',
      socialUrls: { zernio_profile_id: '6a828fcdad7b3b2362f28fdf' },
    })
    assert.equal(metrics.notCollected, RESULTS_NOT_COLLECTED)
    assert.equal(metrics.problem, undefined)
  } finally {
    if (key !== undefined) process.env.ZERNIO_API_KEY = key
  }
})

test('the not-collected sentence names no vendor, no department and no plumbing', () => {
  const banned = [
    'zernio', 'mixpost', 'oauth', 'api', 'endpoint', 'webhook', 'supabase',
    '404', 'workspace', 'department', 'sync',
  ]
  const lower = RESULTS_NOT_COLLECTED.toLowerCase()
  for (const word of banned) {
    assert.equal(lower.includes(word), false, `owner-facing copy must not say "${word}"`)
  }
  // And it must not tell somebody with accounts connected to connect an account.
  assert.equal(lower.includes('connect an account'), false)
})

test('the dead publisher reports call is not reinstated without a live 200', () => {
  // Measured 2026-08-19: /reports, /report, /insights, /statistics, /stats,
  // /metrics, /analytics and /audience all 404 on the running instance, with
  // and without the /api segment, while /accounts and /posts return 200.
  assert.equal(
    SOURCE.includes('fetchMixpostReports'),
    false,
    'that endpoint does not exist on the running build — a call to it returns a 404, and a 404 rendered as an empty measurement is the fault this file closes',
  )
})

test('every empty answer carries a reason — nothing returns a bare empty shell', () => {
  // `emptyMetrics` without a problem is legitimate for "no account on this
  // channel". What must never happen is a *failed read* going out that way,
  // so the catch has to pass a message.
  assert.match(
    SOURCE,
    /catch \(err\) \{\s*return emptyMetrics\(\s*platform,\s*from,\s*to,\s*zernioOwnerMessage/,
    'a failed read must return a problem, never a silent empty measurement',
  )
})

/* ── The account picker actually picks ──────────────────────────────────── */

const ACCOUNTS = [
  { id: 'a1', platform: 'FACEBOOK' },
  { id: 'a2', platform: 'facebook' },
  { id: 'a3', platform: 'instagram' },
]

test('no account chosen reads the first one on that platform', () => {
  assert.equal(selectAccountForReport(ACCOUNTS, 'facebook', null)?.id, 'a1')
})

test('choosing the second page actually reads the second page', () => {
  // The whole point of the selector row. Before this it returned a1 either way.
  assert.equal(selectAccountForReport(ACCOUNTS, 'facebook', 'a2')?.id, 'a2')
})

test("an id from another customer reads nothing, never the brand's first account", () => {
  assert.equal(selectAccountForReport(ACCOUNTS, 'facebook', 'someone-elses-id'), null)
})

test('an id belonging to a different channel of the same brand is not honoured', () => {
  assert.equal(selectAccountForReport(ACCOUNTS, 'facebook', 'a3'), null)
})

test('X is normalised to the twitter key like the rest of the desk', () => {
  assert.equal(selectAccountForReport([{ id: 'x1', platform: 'X' }], 'twitter', null)?.id, 'x1')
})
