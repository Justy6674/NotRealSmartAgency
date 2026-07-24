import assert from 'node:assert/strict'
import test from 'node:test'
import { dispatchTelegramDirectorRequest } from './nrs-director-dispatch.ts'

const brands = [
  { id: 'dotoday-id', name: 'DoToday', slug: 'dotoday' },
  { id: 'telescribe-id', name: 'TeleScribe', slug: 'telescribe' },
]

test('queues the existing Director job with the exact Telegram request', async () => {
  const queued: Array<{ brandId: string; message: string }> = []

  const result = await dispatchTelegramDirectorRequest({
    text: 'Build a launch week for DoToday',
    brands,
    queueDirectorJob: async (input) => {
      queued.push(input)
      return { jobId: 'job-123' }
    },
  })

  assert.deepEqual(queued, [{
    brandId: 'dotoday-id',
    message: 'Build a launch week for DoToday',
  }])
  assert.deepEqual(result, {
    kind: 'queued',
    jobId: 'job-123',
    brand: brands[0],
  })
})

test('asks for a named brand instead of sending an ambiguous request to the Director', async () => {
  let queueCalls = 0

  const result = await dispatchTelegramDirectorRequest({
    text: 'Make a launch week',
    brands,
    queueDirectorJob: async () => {
      queueCalls += 1
      return { jobId: 'unexpected' }
    },
  })

  assert.equal(queueCalls, 0)
  assert.deepEqual(result, {
    kind: 'needs_brand',
    text: 'Which brand should I work on? Name one: DoToday, TeleScribe.',
  })
})

test('uses the owner-selected business when a plain-language request does not name one', async () => {
  const queued: Array<{ brandId: string; message: string }> = []

  const result = await dispatchTelegramDirectorRequest({
    text: 'Make five topical social posts for this week',
    brands,
    selectedBrandId: 'telescribe-id',
    queueDirectorJob: async (input) => {
      queued.push(input)
      return { jobId: 'job-selected' }
    },
  })

  assert.deepEqual(queued, [{
    brandId: 'telescribe-id',
    message: 'Make five topical social posts for this week',
  }])
  assert.deepEqual(result, {
    kind: 'queued',
    jobId: 'job-selected',
    brand: brands[1],
  })
})
