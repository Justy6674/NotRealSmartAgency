import assert from 'node:assert/strict'
import test, { afterEach, beforeEach } from 'node:test'
import { isZernioAdPlatform, listZernioCampaigns } from './client.ts'

/**
 * The one thing this must never do again.
 *
 * `listZernioCampaigns` used to return `[]` from its catch block AND when the
 * API key was missing. So a rotated key answering 401, a 5xx, a timeout and a
 * DNS failure all reached /agency/ads as an empty array, and the page printed
 * "<brand> has no campaigns running" — a calm factual heading over a brand that
 * might have been spending money at that moment.
 *
 * Every case below asserts the same thing from a different angle: a call that
 * did not succeed must not be representable as a successful empty ledger.
 */

const realFetch = globalThis.fetch
const realKey = process.env.ZERNIO_API_KEY

function stubFetch(handler: () => Promise<Response> | Promise<never>) {
  globalThis.fetch = (() => handler()) as typeof fetch
}

beforeEach(() => {
  process.env.ZERNIO_API_KEY = 'test-key'
})

afterEach(() => {
  globalThis.fetch = realFetch
  if (realKey === undefined) delete process.env.ZERNIO_API_KEY
  else process.env.ZERNIO_API_KEY = realKey
})

test('a 401 from a rotated key is not an empty ledger', async () => {
  stubFetch(async () => new Response('Unauthorized', { status: 401 }))

  const result = await listZernioCampaigns('profile-1')

  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.reason, 'unreachable')
})

test('a 5xx is not an empty ledger', async () => {
  stubFetch(async () => new Response('boom', { status: 503 }))

  const result = await listZernioCampaigns('profile-1')

  assert.equal(result.ok, false)
})

test('a network failure is not an empty ledger', async () => {
  stubFetch(async () => {
    throw new Error('fetch failed')
  })

  const result = await listZernioCampaigns('profile-1')

  assert.equal(result.ok, false)
})

test('a missing API key is its own case, not an empty ledger', async () => {
  delete process.env.ZERNIO_API_KEY
  stubFetch(async () => {
    throw new Error('must not be called without a key')
  })

  const result = await listZernioCampaigns('profile-1')

  assert.equal(result.ok, false)
  assert.equal(result.ok === false && result.reason, 'not_configured')
})

test('a response we do not understand is not an empty ledger', async () => {
  // `{ok: true}` with no campaigns array used to fall through to `data || []`.
  stubFetch(async () => Response.json({ ok: true }))

  const result = await listZernioCampaigns('profile-1')

  assert.equal(result.ok, false)
})

test('a genuinely empty list still reads as a successful empty list', async () => {
  stubFetch(async () => Response.json({ campaigns: [] }))

  const result = await listZernioCampaigns('profile-1')

  assert.equal(result.ok, true)
  assert.deepEqual(result.ok === true && result.campaigns, [])
})

test('campaigns come back when Zernio answers with them', async () => {
  stubFetch(async () => Response.json({ campaigns: [{ platformCampaignId: 'c1' }] }))

  const result = await listZernioCampaigns('profile-1')

  assert.equal(result.ok, true)
  assert.equal(result.ok === true && result.campaigns.length, 1)
})

test('a bare array is accepted, since Zernio has returned both shapes', async () => {
  stubFetch(async () => Response.json([{ platformCampaignId: 'c1' }]))

  const result = await listZernioCampaigns()

  assert.equal(result.ok, true)
})

test('only the platforms Zernio accepts pass the guard', () => {
  for (const platform of ['facebook', 'instagram', 'tiktok', 'linkedin', 'pinterest', 'google', 'twitter', 'openai']) {
    assert.ok(isZernioAdPlatform(platform), `${platform} should be accepted`)
  }
  // 'unknown' is what campaign.ts writes when Zernio reported no platform, so
  // it must never be forwarded to an endpoint that changes spending.
  for (const rejected of ['unknown', 'x', '', null, undefined, 42]) {
    assert.equal(isZernioAdPlatform(rejected), false, `${String(rejected)} should be rejected`)
  }
})
