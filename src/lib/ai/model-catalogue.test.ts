import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * Every model NRS can route to must have a verified price.
 *
 * The Gateway's own guidance is that model IDs recalled from memory are stale
 * by default — so the danger is not a typo, it is a plausible-looking ID that
 * was never checked. A model with no pricing entry is silently costed as Opus
 * 5, the most expensive option, which quietly inflates the spend counter that
 * already locked the owner out of his own product once.
 *
 * Read as source text rather than imported, because the routing table and the
 * pricing table are both module-private and exporting them purely for a test
 * would widen the API for no one's benefit.
 */
const SOURCE = readFileSync(new URL('./model-routing.ts', import.meta.url), 'utf8')

function idsIn(block: string): string[] {
  return [...block.matchAll(/'([a-z0-9.\-]+\/[a-z0-9.\-]+)'/gi)].map((match) => match[1])
}

function section(startMarker: string): string {
  const start = SOURCE.indexOf(startMarker)
  assert.notEqual(start, -1, `${startMarker} not found — the table was renamed`)
  const end = SOURCE.indexOf('\n}', start)
  return SOURCE.slice(start, end)
}

test('every routable model has a price', () => {
  const priced = new Set(idsIn(section('const GATEWAY_MODEL_PRICING')))
  const routable = new Set([
    ...idsIn(section('export const GATEWAY_MODELS')),
    ...idsIn(section('const GATEWAY_FALLBACKS')),
  ])

  const unpriced = [...routable].filter((id) => !priced.has(id))
  assert.deepEqual(unpriced, [], `routable with no verified price: ${unpriced.join(', ')}`)
})

test('no legacy model is used as a primary or a fallback', () => {
  // claude-sonnet-4 is still stored against the Director in agent_registry and
  // is correctly ignored at runtime; it must never be reachable from here.
  const legacy = new Set(idsIn(section('const LEGACY_MODEL_IDS')))
  const routable = [
    ...idsIn(section('export const GATEWAY_MODELS')),
    ...idsIn(section('const GATEWAY_FALLBACKS')),
  ]

  const stale = routable.filter((id) => legacy.has(id))
  assert.deepEqual(stale, [], `routing to a model marked legacy: ${stale.join(', ')}`)
})
