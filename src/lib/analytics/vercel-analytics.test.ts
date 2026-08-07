import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  daysAgo,
  escapeODataValue,
  getEventsBy,
  getTrafficBy,
  getTrafficTotals,
  readLabel,
  VercelAnalyticsError,
  vercelAnalyticsConfigured,
} from './vercel-analytics'

function stub(payload: unknown, { ok = true, status = 200 } = {}) {
  const calls: string[] = []
  const fetchImpl = (async (url: string) => {
    calls.push(String(url))
    return {
      ok,
      status,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    }
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

const TARGET = { project: 'scent-australia', team: 'blackhealthintelligence' }

test('totals come back as plain numbers', async () => {
  const { fetchImpl, calls } = stub({ data: { pageviews: 1250, visitors: 980 } })
  const totals = await getTrafficTotals(TARGET, {}, { token: 't', fetchImpl })

  assert.deepEqual(totals, { pageviews: 1250, visitors: 980 })
  assert.match(calls[0], /visits\/count/)
  assert.match(calls[0], /projectId=scent-australia/)
  assert.match(calls[0], /teamId=blackhealthintelligence/)
})

test('a project with no traffic reads as zero, not as an error', async () => {
  const { fetchImpl } = stub({ data: {} })
  assert.deepEqual(await getTrafficTotals(TARGET, {}, { token: 't', fetchImpl }), {
    pageviews: 0,
    visitors: 0,
  })
})

test('top pages come back labelled by route', async () => {
  const { fetchImpl, calls } = stub({
    data: [
      { route: '/listings/[id]', pageviews: 640, visitors: 510 },
      { route: '/', pageviews: 180, visitors: 150 },
    ],
  })
  const rows = await getTrafficBy(TARGET, 'route', { since: '2026-08-01', limit: 5 }, { token: 't', fetchImpl })

  assert.deepEqual(rows[0], { label: '/listings/[id]', pageviews: 640, visitors: 510 })
  assert.match(calls[0], /by=route/)
  assert.match(calls[0], /limit=5/)
  assert.match(calls[0], /since=2026-08-01/)
})

test('a day series is labelled by date, not by a raw timestamp', () => {
  assert.equal(readLabel({ timestamp: '2026-08-01T00:00:00.000Z', pageviews: 10 }, 'day'), '2026-08-01')
})

test('custom events are read from the eventData column', () => {
  // The API returns the grouped value under `eventData`, NOT under the full
  // `eventData/plan` key. Reading the wrong one shows "undefined" to the owner.
  assert.equal(readLabel({ eventData: 'pro', count: 42 }, 'eventData/plan'), 'pro')
})

test('an empty referrer reads as direct traffic, not as blank', () => {
  assert.equal(readLabel({ referrerHostname: '' }, 'referrerHostname'), '(direct / none)')
  assert.equal(readLabel({ referrerHostname: null }, 'referrerHostname'), '(direct / none)')
  assert.equal(readLabel({ eventData: null }, 'eventData/plan'), '(not set)')
})

test('custom events come back with counts', async () => {
  const { fetchImpl, calls } = stub({
    data: [{ eventData: 'pro', count: 42, visitors: 36 }],
  })
  const rows = await getEventsBy(TARGET, 'eventData/plan', {}, { token: 't', fetchImpl })

  assert.deepEqual(rows[0], { label: 'pro', count: 42, visitors: 36 })
  assert.match(calls[0], /events\/aggregate/)
})

test('analytics not switched on is reported as a setting, not a crash', async () => {
  const { fetchImpl } = stub({ error: 'forbidden' }, { ok: false, status: 403 })
  await assert.rejects(
    () => getTrafficTotals(TARGET, {}, { token: 't', fetchImpl }),
    (error: VercelAnalyticsError) => {
      assert.match(error.message, /may not be switched on/)
      assert.equal(error.status, 403)
      return true
    },
  )
})

test('a missing token fails loudly rather than silently returning nothing', async () => {
  const { fetchImpl } = stub({})
  await assert.rejects(
    () => getTrafficTotals(TARGET, {}, { token: undefined, fetchImpl }),
    /VERCEL_API_TOKEN is not set/,
  )
  assert.equal(vercelAnalyticsConfigured({} as unknown as NodeJS.ProcessEnv), false)
  assert.equal(vercelAnalyticsConfigured({ VERCEL_API_TOKEN: 'x' } as unknown as NodeJS.ProcessEnv), true)
})

test('a personal-account project sends no team', async () => {
  const { fetchImpl, calls } = stub({ data: { pageviews: 1, visitors: 1 } })
  await getTrafficTotals({ project: 'solo' }, {}, { token: 't', fetchImpl })
  assert.doesNotMatch(calls[0], /teamId/)
})

test("a quote in a filter value cannot break out of the filter", () => {
  // Otherwise a page path containing an apostrophe would end the string early
  // and change which rows the query returns.
  assert.equal(escapeODataValue("/o'brien"), "/o''brien")
})

test('a date window is computed from a passed clock, never an ambient one', () => {
  const now = new Date('2026-08-07T10:00:00.000Z')
  assert.equal(daysAgo(7, now), '2026-07-31')
  assert.equal(daysAgo(0, now), '2026-08-07')
})
