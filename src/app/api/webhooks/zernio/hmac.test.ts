import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { verifyZernioWebhook } from './verify.ts'

const source = readFileSync(join(process.cwd(), 'src/app/api/webhooks/zernio/route.ts'), 'utf8')

test('HMAC is computed on the raw body, not parsed JSON', () => {
  assert.match(source, /request\.text\(\)/)
  assert.doesNotMatch(source, /if \(secret && signature\)/)
})

test('secret set and missing signature is 401', () => {
  const result = verifyZernioWebhook({
    secret: 'test-secret',
    signature: null,
    rawBody: '{"event":"post.published"}',
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.status, 401)
})

test('secret missing after fail-closed is 503', () => {
  const result = verifyZernioWebhook({
    secret: undefined,
    signature: 'abc',
    rawBody: '{}',
  })
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.status, 503)
})

test('inbox insert is backlog, never pending, and never assigns overall as a uuid', () => {
  assert.match(source, /status:\s*['"]backlog['"]/)
  assert.doesNotMatch(source, /assigned_agent_id:\s*['"]overall['"]/)
  assert.doesNotMatch(source, /ilike\(['"]name['"]/)
})
