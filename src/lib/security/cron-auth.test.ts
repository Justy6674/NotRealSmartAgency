import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isCronAuthorised } from './cron-auth'

/**
 * These pin the one behaviour the inline check got wrong: what happens when
 * CRON_SECRET is not set. The old form built `Bearer ${undefined}` and let
 * anyone who sent that exact header through to a service-role client.
 */

function requestWith(authorization?: string): Request {
  return new Request('https://example.test/api/cron/publish-posts', {
    headers: authorization ? { authorization } : {},
  })
}

function withSecret<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.CRON_SECRET
  if (value === undefined) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = value
  try {
    return run()
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  }
}

test('an unset secret authorises nobody', () => {
  withSecret(undefined, () => {
    assert.equal(isCronAuthorised(requestWith('Bearer undefined')), false)
    assert.equal(isCronAuthorised(requestWith('Bearer ')), false)
    assert.equal(isCronAuthorised(requestWith('Bearer anything')), false)
    assert.equal(isCronAuthorised(requestWith()), false)
  })
})

test('a blank secret authorises nobody', () => {
  // An env var set to an empty string, or to whitespace, is the same failure
  // mode wearing a different hat.
  for (const blank of ['', '   ']) {
    withSecret(blank, () => {
      assert.equal(isCronAuthorised(requestWith(`Bearer ${blank}`)), false)
      assert.equal(isCronAuthorised(requestWith('Bearer undefined')), false)
    })
  }
})

test('the configured secret authorises, and nothing else does', () => {
  withSecret('s3cret-value', () => {
    assert.equal(isCronAuthorised(requestWith('Bearer s3cret-value')), true)

    assert.equal(isCronAuthorised(requestWith('bearer s3cret-value')), false)
    assert.equal(isCronAuthorised(requestWith('Bearer s3cret-valu')), false)
    assert.equal(isCronAuthorised(requestWith('Bearer s3cret-values')), false)
    assert.equal(isCronAuthorised(requestWith('Bearer undefined')), false)
    assert.equal(isCronAuthorised(requestWith('s3cret-value')), false)
    assert.equal(isCronAuthorised(requestWith()), false)
  })
})
