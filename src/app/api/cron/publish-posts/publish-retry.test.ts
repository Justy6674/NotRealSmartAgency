import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./route.ts', import.meta.url), 'utf8')

test('an unreachable publisher requeues the post instead of failing it', () => {
  // The throw said "Will retry." and the catch wrote failed anyway, so a
  // momentary outage — a restart, a DNS cutover, a network blip — permanently
  // discarded real scheduled content that nothing ever picked up again.
  assert.match(source, /class PublisherUnreachableError/)
  assert.match(source, /err instanceof PublisherUnreachableError/)
  assert.match(source, /status: 'scheduled', error: null/)

  // The old message must not come back — it promised a retry that never existed.
  assert.doesNotMatch(source, /Will retry\./)
})

test('a publisher that rejects the content still fails the post', () => {
  // Only unreachability is retryable. A real rejection is a verdict about the
  // content and must not loop forever.
  const catchBlock = source.slice(source.lastIndexOf('} catch (err: unknown) {'))
  assert.match(catchBlock, /status: 'failed', error: message/)
})

test('in-flight posts are reconciled against the publisher, not timed out blind', () => {
  // MIXPOST_WEBHOOK_SECRET was never set, so waiting for a webhook meant every
  // post was marked failed after ten minutes — seven were live on the platforms
  // while NRS recorded them as failures.
  assert.match(source, /fetchMixpostPost/)
  assert.doesNotMatch(source, /no webhook confirmation received/)
})

test('an unrecognised publisher state leaves the post alone', () => {
  // Guessing a verdict from an unknown status is how the original defect
  // behaved. Unknown must mean wait, not decide.
  assert.match(source, /function mixpostPostState/)
  assert.match(source, /return null/)
})
