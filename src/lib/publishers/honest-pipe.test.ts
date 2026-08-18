import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

test('createZernioPost sends platformSpecificData from the mapper', () => {
  const client = src('src/lib/zernio/client.ts')
  assert.match(client, /platformSpecificData\?: Record<string, unknown>/)
  assert.match(client, /platformSpecificData: params\.platformSpecificData/)

  const dispatcher = src('src/lib/publishers/dispatcher.ts')
  assert.match(dispatcher, /toZernioPlatformData\(/)
  assert.match(dispatcher, /platformSpecificData,/)
  assert.match(dispatcher, /idempotencyKey: req\.idempotency_key/)
})

test('cron and publish-now both put post_type and platform_options on the request', () => {
  const cron = src('src/app/api/cron/publish-posts/route.ts')
  assert.match(cron, /post_type: \(post as Record<string, unknown>\)\.post_type as string \| null/)
  assert.match(cron, /platform_options: platformOptionsOf\(/)
  assert.doesNotMatch(cron, /post_type: \(post as Record<string, unknown>\)\.post_type \?\? null,/)

  const now = src('src/app/api/scheduled-posts/publish-now/route.ts')
  assert.match(now, /post_type: \(post as Record<string, unknown>\)\.post_type as string \| null/)
  assert.match(now, /platform_options: platformOptionsOf\(/)
})

test('publish-ticked uses a stable idempotency key and does not label unsent as zernio', () => {
  const ticked = src('src/lib/publishers/publish-ticked.ts')
  assert.match(ticked, /idempotencyKeyForAccount\(/)
  assert.doesNotMatch(ticked, /randomUUID\(\)/)
  assert.match(ticked, /publisher: 'unsent'/)
})
