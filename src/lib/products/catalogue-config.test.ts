import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalogueConfig, catalogueClient, catalogueAvailable } from './fragrance-catalogue'

/**
 * The fragrance check could never run in production.
 *
 * The old guard tested only that FRAGRANCE_CATALOGUE_URL and _KEY were
 * non-empty, then handed them to createClient, which throws on a value that is
 * not a URL. Production holds a malformed URL, so every Scent Sell
 * verification threw `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL`
 * — and that raw client error was read out to the owner as the reason his
 * fragrance could not be confirmed.
 *
 * The catalogue contains `Kajal | Aican`. The owner had told the Director the
 * name himself. One query would have settled it, and the check that was
 * supposed to run it had never worked in production once.
 */

const VALID = {
  FRAGRANCE_CATALOGUE_URL: 'https://example.supabase.co',
  FRAGRANCE_CATALOGUE_KEY: 'sb_publishable_abc123',
}

test('a correctly configured catalogue is available', () => {
  assert.deepEqual(catalogueConfig(VALID), { ok: true })
  assert.equal(catalogueAvailable(VALID), true)
})

test('missing and malformed are different faults with different fixes', () => {
  const missing = catalogueConfig({ FRAGRANCE_CATALOGUE_KEY: 'k' })
  assert.equal(missing.ok, false)
  assert.equal(missing.ok === false && missing.reason, 'missing')

  const malformed = catalogueConfig({ ...VALID, FRAGRANCE_CATALOGUE_URL: 'not-a-url' })
  assert.equal(malformed.ok, false)
  assert.equal(malformed.ok === false && malformed.reason, 'malformed')
})

test('a value pasted with its quotes is caught by name', () => {
  const quoted = catalogueConfig({ ...VALID, FRAGRANCE_CATALOGUE_URL: '"https://example.supabase.co"' })

  assert.equal(quoted.ok, false)
  assert.match(
    quoted.ok === false ? quoted.detail : '',
    /wrapped in quotes/,
    'the detail must name the actual mistake, since the value looks set from every other angle',
  )
})

test('a non-http scheme is rejected before Supabase sees it', () => {
  const bad = catalogueConfig({ ...VALID, FRAGRANCE_CATALOGUE_URL: 'postgres://example.supabase.co' })
  assert.equal(bad.ok, false)
  assert.equal(bad.ok === false && bad.reason, 'malformed')
})

test('a bad configuration returns null instead of throwing into the answer', () => {
  // This is the whole fix: a config fault must degrade the reply, never become
  // the reply. The Director quoted the client's own exception at the owner.
  assert.doesNotThrow(() => catalogueClient({ FRAGRANCE_CATALOGUE_URL: 'not-a-url', FRAGRANCE_CATALOGUE_KEY: 'k' }))
  assert.equal(catalogueClient({ FRAGRANCE_CATALOGUE_URL: 'not-a-url', FRAGRANCE_CATALOGUE_KEY: 'k' }), null)
  assert.equal(catalogueClient({}), null)
})
