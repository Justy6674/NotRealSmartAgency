import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * A post that published must never be reported as failed.
 *
 * The publish cron marks a row `publishing`, then a sweep reconciles it against
 * the publisher. That sweep asked Mixpost and only Mixpost, behind a
 * `/^[0-9a-f-]{36}$/` guard matching a Mixpost UUID. A Zernio id is a
 * 24-character Mongo ObjectId, so every Zernio post failed the guard, was never
 * looked up, and fell through to:
 *
 *     'Never reached the publisher — no post was created.'
 *
 * The post was live on Facebook at the time. The owner's obvious next move —
 * publish it again — puts it on the page twice, which for a regulated health
 * brand is a second unreviewed advertisement.
 *
 * Two invariants, because the second is the general form of the first: ask the
 * publisher that actually sent it, and never convert "we could not identify
 * this" into "this did not go out".
 *
 * Asserted against source: reproducing it needs a live post in `publishing`
 * with a real upstream id, which a unit test has no way to create.
 */

const source = readFileSync(
  join(process.cwd(), 'src/app/api/cron/publish-posts/route.ts'),
  'utf8',
)

const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')

test('the sweep asks Zernio about Zernio ids', () => {
  assert.ok(
    code.includes('fetchZernioPostStatus'),
    'a Zernio post must be reconciled against Zernio, not against Mixpost',
  )
  assert.match(
    code,
    /\/\^\[0-9a-f\]\{24\}\$\/i/,
    'the 24-character ObjectId shape must be recognised — it is what the old UUID guard missed',
  )
})

test('an unrecognised id is never written off as unsent', () => {
  // The guard that matters: with an external id present, the row is left for the
  // next tick regardless of shape. Only a row that never received an id may be
  // declared failed, because only that is evidence of anything.
  assert.match(
    code,
    /if \(externalId\) continue/,
    'a row holding a publisher id must not be marked failed for being unrecognised',
  )

  const writeOff = code.indexOf('Never reached the publisher')
  const guard = code.indexOf('if (externalId) continue')
  assert.ok(writeOff > -1, 'expected the write-off branch to still exist for genuinely unsent rows')
  assert.ok(
    guard > -1 && guard < writeOff,
    'the guard must come BEFORE the write-off, or unrecognised ids still get declared failed',
  )
})

test('an unknown status is not a verdict', () => {
  const client = readFileSync(join(process.cwd(), 'src/lib/zernio/client.ts'), 'utf8')
  // zernioPostState must fall through to null rather than guessing. The exact
  // status enum is unconfirmed against a live post, so anything not clearly
  // terminal has to mean "ask again", not "failed".
  assert.match(
    client,
    /export function zernioPostState[\s\S]{0,600}?return null/,
    'an unrecognised Zernio status must return null so the sweep retries',
  )
})
