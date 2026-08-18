import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  assertZernioJson,
  unwrapZernio,
  ZernioError,
  ZernioHtmlResponseError,
} from './errors.ts'

/**
 * A wrong path answers 200 with a web page, so `if (!res.ok) throw` is decoration.
 *
 * Measured live on 2026-08-18: `GET https://zernio.com/api/v1/anything-wrong`
 * returns **HTTP 200, text/html** — the publisher's own Next.js shell — not a
 * 404. Proven against two real mistakes: `/v1/validate/post` when the path is
 * `/v1/tools/validate/post`, and `/v1/analytics/best-time-to-post` when the
 * path is `/v1/analytics/best-time`.
 *
 * Six call sites in this codebase guarded with `if (!res.ok) throw`. None of
 * them could ever fire on the failure that actually happens. What the owner saw
 * instead was an empty screen, or a parse error thrown a long way from its
 * cause.
 */

function htmlResponse(status = 200) {
  return new Response('<!doctype html><html><body>Zernio</body></html>', {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('a 200 text/html response throws instead of reading as success', () => {
  const res = htmlResponse(200)
  assert.equal(res.ok, true, 'the trap only matters because the response IS ok')

  assert.throws(
    () => assertZernioJson(res, 'validate.validatePost'),
    (err: unknown) => {
      assert.ok(err instanceof ZernioHtmlResponseError, 'must be recognisable as a wrong path')
      assert.match((err as Error).message, /path is wrong/i)
      return true
    },
  )
})

test('an HTML error page is a wrong path too, not just an unhappy status', () => {
  assert.throws(() => assertZernioJson(htmlResponse(500), 'ads.listCampaigns'), ZernioHtmlResponseError)
})

test('a JSON response passes, and a JSON error still throws with its status', () => {
  assert.doesNotThrow(() => assertZernioJson(jsonResponse({ ok: true }), 'posts.listPosts'))

  assert.throws(
    () => assertZernioJson(jsonResponse({ error: 'nope' }, 401), 'posts.listPosts'),
    (err: unknown) => {
      assert.ok(err instanceof ZernioError)
      assert.equal((err as ZernioError).status, 401)
      return true
    },
  )
})

test('a response with no content type is not trusted as JSON', () => {
  const res = new Response('', { status: 200 })
  // An empty content type is exactly what a proxy or an edge shell returns.
  // Treating it as JSON is how "successfully received nothing" gets invented.
  assert.throws(() => assertZernioJson(res, 'queue.listQueueSlots'), ZernioHtmlResponseError)
})

test('unwrapZernio reads error before data', () => {
  // The SDK does NOT throw on an API error: it resolves { data, error }.
  // Destructuring { data } alone turns a 401 into undefined and then into an
  // empty list, which is the HTML trap wearing different clothes.
  assert.throws(
    () => unwrapZernio('accounts.listAccounts', { error: { error: 'Unauthorised' } }),
    (err: unknown) => {
      assert.ok(err instanceof ZernioError)
      assert.match((err as Error).message, /Unauthorised/)
      return true
    },
  )

  assert.throws(
    () => unwrapZernio('accounts.listAccounts', { data: undefined }),
    /no payload/,
  )

  assert.deepEqual(unwrapZernio('accounts.listAccounts', { data: { accounts: [] } }), {
    accounts: [],
  })
})

test('unwrapZernio refuses an SDK response that came back as a web page', () => {
  assert.throws(
    () => unwrapZernio('posts.listPosts', { data: { posts: [] }, response: htmlResponse(200) }),
    ZernioHtmlResponseError,
  )
})

test('every raw publisher fetch in this directory is guarded by the content-type check', () => {
  // Asserted against the source because the guard is only worth anything if it
  // is on EVERY hand-rolled call. One unguarded fetch is one silent empty
  // screen, and the six that existed all looked correct at a glance.
  const source = readFileSync(join(process.cwd(), 'src/lib/zernio/client.ts'), 'utf8')
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')

  const fetches = code.match(/await fetch\(/g) ?? []
  const guards = code.match(/assertZernioJson\(/g) ?? []
  assert.ok(fetches.length > 0, 'expected at least one raw fetch to guard')
  assert.ok(
    guards.length >= fetches.length,
    `${fetches.length} raw publisher fetches but only ${guards.length} content-type guards`,
  )

  assert.doesNotMatch(
    code,
    /if \(!res\.ok\) throw new Error\(`Zernio/,
    'the status-only guard cannot fire on a wrong path — use assertZernioJson',
  )
})
