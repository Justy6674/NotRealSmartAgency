import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'
import { verifyMixpostWebhookSignature } from './mixpost-signature.ts'

const body = JSON.stringify({ event: 'post.published', data: { post_id: 'post-123' } })
const secret = 'test-webhook-secret'
const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

test('rejects a missing Mixpost webhook secret outside local development', () => {
  assert.deepEqual(
    verifyMixpostWebhookSignature(body, null, { environment: 'production' }),
    { ok: false, reason: 'missing-secret' },
  )
})

test('permits an unsigned webhook only in local development', () => {
  assert.deepEqual(
    verifyMixpostWebhookSignature(body, null, { environment: 'development' }),
    { ok: true },
  )
})

test('permits an unsigned webhook in the test environment', () => {
  assert.deepEqual(
    verifyMixpostWebhookSignature(body, null, { environment: 'test' }),
    { ok: true },
  )
})

test('accepts a valid Mixpost webhook signature', () => {
  assert.deepEqual(
    verifyMixpostWebhookSignature(body, signature, { secret, environment: 'production' }),
    { ok: true },
  )
})

test('rejects an invalid Mixpost webhook signature', () => {
  assert.deepEqual(
    verifyMixpostWebhookSignature(body, 'not-the-signature', { secret, environment: 'production' }),
    { ok: false, reason: 'invalid-signature' },
  )
})
