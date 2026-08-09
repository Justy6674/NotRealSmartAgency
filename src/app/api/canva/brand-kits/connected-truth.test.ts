import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * "It said Canva was connected. It was not."
 *
 * The route answered HTTP 200 for every outcome, putting the real result in
 * the body — and the panel only checked whether the REQUEST succeeded. So a
 * connection rejecting every call rendered as "Connected — 0 brand kits", and
 * the owner had no way to know it had never worked.
 *
 * A status panel that can say "connected" while nothing works is worse than no
 * status panel, because it sends you looking for the fault somewhere else.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

test('the route reports connectedness as data, not as an HTTP status', () => {
  const route = read('src/app/api/canva/brand-kits/route.ts')
  assert.match(route, /connected: true, state: 'ready'/)
  assert.match(route, /getCanvaState\(supabase, user\.id\)/)
  assert.match(route, /connected: false,\s*\n\s*state: state\.state/)
  // Every failure path must say connected:false. Three of them.
  const falses = route.match(/connected: false/g) ?? []
  assert.ok(falses.length >= 3, `every failure must report connected:false, found ${falses.length}`)
})

test('the panel reads the body, not just whether the request succeeded', () => {
  const panel = read('src/components/agency/ConnectionsPanel.tsx')
  assert.match(panel, /data\.connected !== true/)
  // The old test — `if (r.ok) return connected:true` — is what caused this.
  assert.doesNotMatch(panel, /if \(r\.ok\) \{\s*\n\s*const data/)
})

test('the dead environment key is never used as a fallback', () => {
  // CANVA_API_KEY returns 401 for every request: Canva Connect is OAuth only.
  // Falling back to it turned "not connected" into "connected but failing".
  const route = read('src/app/api/canva/brand-kits/route.ts')
  assert.doesNotMatch(route, /apiKey = process\.env\.CANVA_API_KEY/)

  const tools = read('src/lib/agents/tools/canva.ts')
  assert.match(tools, /requireCanva/)
  // Only a comment about the history may mention it — never a call.
  assert.doesNotMatch(tools, /await getCanvaToken\(/)

  // And the fallback is gone at source, so nothing can reach it.
  const client = read('src/lib/canva/client.ts')
  assert.doesNotMatch(client, /process\.env\.CANVA_API_KEY/)
})

test('each failure names a different next step', () => {
  const status = read('src/lib/canva/status.ts')
  assert.match(status, /Canva is not connected/) // never set up
  assert.match(status, /connection has expired/) // reconnect
  assert.match(status, /did not respond just now/) // Canva down
})
