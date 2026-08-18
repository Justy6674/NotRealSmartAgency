import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A guardrail, not a unit test.
 *
 * public/sw.js runs in a worker with no bundler and no imports, so it cannot be
 * imported and exercised here — and it is also the one file in this product
 * that can serve one business's screen to another. A cache lives on the device,
 * outlives the session, and knows nothing about signing out; RLS, the auth
 * check in the layout and every gate in the codebase sit on the SERVER side of
 * a response the worker may hand back without asking anyone.
 *
 * So the boundary is asserted against the source text. If someone later decides
 * a dashboard would feel faster with its API responses cached, or turns
 * navigations into stale-while-revalidate, this fails and says why rather than
 * shipping quietly and surfacing months later as "it showed me the wrong
 * clinic's posts".
 */
const sw = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')

test('the worker never handles anything under /api', () => {
  assert.match(
    sw,
    /if \(url\.pathname\.startsWith\('\/api\/'\)\) return/,
    'every figure about a business comes through /api — the worker must bail before it can cache one',
  )
})

test('server-component payloads are left alone too', () => {
  assert.match(
    sw,
    /url\.searchParams\.has\('_rsc'\)/,
    'an RSC payload is the same tenant data in a different wrapper',
  )
  assert.match(sw, /text\/x-component/)
})

test('no HTML is ever written to the cache', () => {
  const navBlock = sw.slice(sw.indexOf("request.mode === 'navigate'"))
  assert.doesNotMatch(
    navBlock,
    /cache\.put|caches\.open/,
    'signed-in pages are rendered with the business content already in them; caching one caches somebody’s data',
  )
})

test('only the build’s own content-hashed output is cacheable', () => {
  const prefixes = sw.match(/const STATIC_PREFIXES = \[([^\]]*)\]/)
  assert.ok(prefixes, 'STATIC_PREFIXES must exist')
  const listed = prefixes[1]
  assert.match(listed, /'\/_next\/static\/'/)
  assert.doesNotMatch(listed, /'\/agency/, 'the desk is not a static asset')
  assert.doesNotMatch(listed, /'\/api/, 'nor is anything under /api')
})

test('cross-origin responses are never stored', () => {
  assert.match(
    sw,
    /url\.origin !== self\.location\.origin\) return/,
    'a third party’s response has no business in our cache',
  )
  assert.match(
    sw,
    /response\.type === 'basic'/,
    'an opaque response cached here would be served forever as if it were the real file',
  )
})
