import assert from 'node:assert/strict'
import test from 'node:test'
import { getDirectorCompletion } from './director-completion'

test('accepts a final Director answer with no pending tools', () => {
  assert.deepEqual(getDirectorCompletion({
    text: 'The audit is complete.',
    finishReason: 'stop',
    steps: [{ toolCalls: [] }],
  }), { complete: true, response: 'The audit is complete.' })
})

test('rejects the bridge text from a Director still calling tools', () => {
  assert.deepEqual(getDirectorCompletion({
    text: 'Let me get the actual content of the draft from the database directly.',
    finishReason: 'tool-calls',
    steps: [{ toolCalls: [{ toolName: 'query_calendar' }] }],
  }), {
    complete: false,
    reason: 'The Director reached its tool-step limit while still gathering information.',
  })
})

test('rejects empty and truncated Director responses', () => {
  assert.equal(getDirectorCompletion({ text: '   ' }).complete, false)
  assert.equal(getDirectorCompletion({ text: 'Part one of the answer', finishReason: 'length' }).complete, false)
})
