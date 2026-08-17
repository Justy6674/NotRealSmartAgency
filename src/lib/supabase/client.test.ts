import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Login hung on production 2026-08-18: Chrome banner "controlled by
 * automated test software" + gotrue warning that lock
 * `lock:sb-uyhtrwlotoriblicqqrl-auth-token` was not released in 5000ms.
 * Automated Chrome's Web Locks API orphans locks; steal:true can hang too.
 * The browser client must skip navigator.locks when navigator.webdriver
 * is set, without turning persistSession off (that would drop the cookie).
 */

const source = readFileSync(
  join(process.cwd(), 'src/lib/supabase/client.ts'),
  'utf8',
)

test('automated Chrome does not use navigator.locks for auth', () => {
  assert.match(
    source,
    /navigator\.webdriver/,
    'must detect the automated-browser flag that CDP Chrome sets',
  )
  assert.match(
    source,
    /auth:\s*\{\s*lock:/,
    'must pass a custom lock so gotrue does not call navigator.locks.request',
  )
})

test('session persistence stays on — the lock is swapped, not persistence', () => {
  assert.doesNotMatch(
    source,
    /persistSession:\s*false/,
    'turning persistence off would sign in then immediately drop the cookie',
  )
})
