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
      chain.maybeSingle = async () => ({ data: cached === undefined ? null : { cached_data: cached }, error: null })
      return chain
    },
  } as unknown as SupabaseClient
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

test('a stored token is used', async () => {
  const state = await getCanvaState(withCachedData({ api_key: 'real-oauth-token' }), 'user')
  assert.deepEqual(state, { state: 'ready', token: 'real-oauth-token' })
})

test('a live token that has not expired is still ready', async () => {
  const future = new Date(Date.now() + 3_600_000).toISOString()
  const state = await getCanvaState(
    withCachedData({ api_key: 'tok', expires_at: future, refresh_token: 'r' }),
    'user',
  )
  assert.equal(state.state, 'ready')
})

test('expired with no way to refresh asks for a reconnect', async () => {
  const past = new Date(Date.now() - 3_600_000).toISOString()
  const state = await getCanvaState(withCachedData({ api_key: 'tok', expires_at: past }), 'user')
  assert.equal(state.state, 'expired')
  assert.match(state.message!, /Reconnect it/)
})

test('expired but refreshable is left to the refresh path', async () => {
  const past = new Date(Date.now() - 3_600_000).toISOString()
  const state = await getCanvaState(
    withCachedData({ api_key: 'tok', expires_at: past, refresh_token: 'r' }),
    'user',
  )
  assert.equal(state.state, 'ready')
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
