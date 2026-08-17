import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Zernio does not scope accounts to a profile. We do.
 *
 * `listAccounts({ profileId })` accepts the argument and ignores it. Measured
 * against the live account on 2026-08-17: ten accounts returned with the filter,
 * the same ten without it. Zernio's multi-tenant guide states the rule directly —
 * validation is "against your whole team, not against a profile", and the
 * integrator must "only pass a customer their own account IDs".
 *
 * This was not theoretical. `fetchZernioAccounts(profileId)` carried a comment
 * asserting the filter worked, and callers used its result to answer "does this
 * account belong to this brand". Against an unfiltered list that answer is always
 * yes, so an ownership check built on it permitted every account in the team —
 * one customer reading another's. Separately, the same social accounts sit under
 * more than one profile, so a publisher matching on platform alone could match
 * twice and post identical content twice to one page.
 *
 * Asserted against the source because reproducing it needs live credentials and
 * a second populated profile, which a unit test has neither of.
 */

const source = readFileSync(
  join(process.cwd(), 'src/lib/zernio/client.ts'),
  'utf8',
)

/**
 * Comments in this file quote the very expressions under test — the doc comment
 * on normaliseAccount spells out `a.profileId === profileId` while explaining the
 * bug it exists to prevent. Searching raw text therefore finds prose before code
 * and reports a fault that is not there. Order is checked against code only.
 */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')

test('accounts are filtered by profile in our code, not left to Zernio', () => {
  assert.match(
    source,
    /a\.profileId === profileId/,
    'fetchZernioAccounts must filter by each account\'s own profileId — Zernio ignores the argument',
  )
})

test('the filter is applied after normalisation', () => {
  // The raw field is sometimes a populated {_id, name} object rather than a
  // string. Comparing before normaliseAccount runs is the object-vs-string
  // mismatch that already made the publish cron never select Zernio at all.
  const filterAt = code.indexOf('a.profileId === profileId')
  const normaliseAt = code.indexOf('accounts.map(normaliseAccount)')
  assert.ok(filterAt > -1 && normaliseAt > -1, 'expected both the filter and the normalise step')
  assert.ok(
    filterAt > normaliseAt,
    'filtering before normalisation compares an object to a string and silently matches nothing',
  )
})

test('the discredited claim that Zernio filters is not restored', () => {
  assert.doesNotMatch(
    source,
    /The Zernio API accepts profileId as a filter/,
    'that comment was measured false — restoring it invites the ownership bug back',
  )
})
