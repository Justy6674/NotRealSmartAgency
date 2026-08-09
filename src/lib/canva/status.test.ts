import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { SupabaseClient } from '@supabase/supabase-js'
import { describeCanvaFailure, getCanvaState } from './status'

function withCachedData(cached: unknown): SupabaseClient {
  return {
    from() {
      const chain: Record<string, unknown> = {}
      chain.select = () => chain
      chain.eq = () => chain
      chain.or = () => chain
      chain.update = () => chain
      chain.insert = () => Promise.resolve({ error: null })
      chain.maybeSingle = async () => ({
        data: cached === undefined ? null : { id: 'canva-integration', cached_data: cached, refresh_version: 0 },
        error: null,
      })
      chain.single = async () => ({
        data: cached === undefined ? null : { id: 'canva-integration', cached_data: cached, refresh_version: 0 },
        error: null,
      })
      return chain
    },
  } as unknown as SupabaseClient
}

async function withMockedFetch<T>(
  fetchMock: typeof fetch,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch
  globalThis.fetch = fetchMock
  try {
    return await run()
  } finally {
    globalThis.fetch = originalFetch
  }
}

test('never connected says so, and forbids pretending otherwise', async () => {
  const state = await getCanvaState(withCachedData(undefined), 'user')
  assert.equal(state.state, 'not_connected')
  assert.match(state.message!, /not connected/)
  assert.match(state.message!, /Settings → Integrations → Canva/)
  // The Director told the owner it had "checked Canva brand kits" when it had
  // never had a working token. That must be impossible to say.
  assert.match(state.message!, /Do NOT claim to have looked at a Canva template/)
})

test('the environment key is NEVER used as a fallback', async () => {
  // It returns 401 for every request — Canva Connect is OAuth only. Handing it
  // out turns "not set up" into "mysteriously broken".
  process.env.CANVA_API_KEY = 'a-key-that-cannot-work'
  const state = await getCanvaState(withCachedData(null), 'user')
  assert.equal(state.state, 'not_connected')
  assert.ok(!('token' in state))
  delete process.env.CANVA_API_KEY
})

test('a stored token is ready only after Canva accepts it', async () => {
  const state = await withMockedFetch(
    async () => new Response(JSON.stringify({ items: [] }), { status: 200 }),
    () => getCanvaState(withCachedData({ api_key: 'real-oauth-token' }), 'user'),
  )
  assert.deepEqual(state, { state: 'ready', token: 'real-oauth-token' })
})

test('a token Canva rejects is never reported ready', async () => {
  const future = new Date(Date.now() + 3_600_000).toISOString()
  const state = await withMockedFetch(
    async () => new Response(JSON.stringify({ message: 'Unauthorised' }), { status: 401 }),
    () => getCanvaState(withCachedData({ api_key: 'tok', expires_at: future }), 'user'),
  )
  assert.equal(state.state, 'expired')
  assert.match(state.message!, /Reconnect it/)
})

test('expired with no way to refresh asks for a reconnect', async () => {
  const past = new Date(Date.now() - 3_600_000).toISOString()
  const state = await getCanvaState(withCachedData({ api_key: 'tok', expires_at: past }), 'user')
  assert.equal(state.state, 'expired')
  assert.match(state.message!, /Reconnect it/)
})

test('a rejected token is refreshed once before a reconnect is requested', async () => {
  const originalClientId = process.env.CANVA_CLIENT_ID
  const originalClientSecret = process.env.CANVA_CLIENT_SECRET
  process.env.CANVA_CLIENT_ID = 'test-client-id'
  process.env.CANVA_CLIENT_SECRET = 'test-client-secret'

  const requests: string[] = []
  try {
    const state = await withMockedFetch(
      async (input) => {
        const url = String(input)
        requests.push(url)
        if (url.endsWith('/brand-templates?limit=1') && requests.length === 1) {
          return new Response(JSON.stringify({ message: 'Unauthorised' }), { status: 401 })
        }
        if (url.endsWith('/oauth/token')) {
          return new Response(JSON.stringify({
            access_token: 'fresh-token',
            refresh_token: 'fresh-refresh-token',
            expires_in: 3600,
          }), { status: 200 })
        }
        return new Response(JSON.stringify({ items: [] }), { status: 200 })
      },
      () => getCanvaState(
        withCachedData({ api_key: 'rejected-token', refresh_token: 'refresh-token' }),
        'user',
      ),
    )

    assert.deepEqual(state, { state: 'ready', token: 'fresh-token' })
    assert.deepEqual(requests.map((url) => new URL(url).pathname), [
      '/rest/v1/brand-templates',
      '/rest/v1/oauth/token',
      '/rest/v1/brand-templates',
    ])
  } finally {
    if (originalClientId === undefined) delete process.env.CANVA_CLIENT_ID
    else process.env.CANVA_CLIENT_ID = originalClientId
    if (originalClientSecret === undefined) delete process.env.CANVA_CLIENT_SECRET
    else process.env.CANVA_CLIENT_SECRET = originalClientSecret
  }
})

test('a 401 from Canva is a reconnect, not "try again"', () => {
  assert.equal(describeCanvaFailure(401).state, 'expired')
  assert.equal(describeCanvaFailure(403).state, 'expired')
})

test('Canva being down is a try-again, and still forbids pretending', () => {
  const state = describeCanvaFailure(503)
  assert.equal(state.state, 'unavailable')
  assert.match(state.message!, /Try again shortly/)
  assert.match(state.message!, /Do NOT claim to have seen a template/)
})
