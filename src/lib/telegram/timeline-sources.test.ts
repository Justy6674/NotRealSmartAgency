import assert from 'node:assert/strict'
import test from 'node:test'
import { directorJobSource } from './timeline-sources'

test('a completed Director job replaces Working with its stored response', () => {
  const events = directorJobSource.map([{
    id: 'job-1',
    status: 'done',
    input: { message: 'Create the carousel.' },
    result: { response: 'The work did not create a Canva design, so it is not complete.' },
    error: null,
    created_at: '2026-08-09T02:21:49.530Z',
    completed_at: '2026-08-09T02:23:52.018Z',
  }], { brandId: 'brand-1', nowMs: Date.parse('2026-08-09T02:24:00.000Z') })

  assert.deepEqual(events.map((event) => event.payload.kind), ['user_message', 'director_reply'])
  assert.equal(events.some((event) => event.payload.kind === 'director_pending'), false)
})
