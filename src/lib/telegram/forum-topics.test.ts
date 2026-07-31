import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readThreadId, describeTopicSetup } from './forum-topics'

/**
 * A topic per project removes the picker: the thread says which brand is meant.
 * The risk it introduces is posting to the WRONG brand, so an unmapped thread
 * must fall back to asking rather than guessing.
 */

test('reads the forum thread id off a message', () => {
  assert.equal(readThreadId({ message_thread_id: 42 }), 42)
})

test('a message outside a topic has no thread', () => {
  assert.equal(readThreadId({}), null)
  assert.equal(readThreadId({ message_thread_id: 'nope' }), null)
})

test('setup reports what it made and what already existed', () => {
  const text = describeTopicSetup({
    created: ['ScentSell'],
    existing: ['NotRealSmart'],
    failed: [],
  })
  assert.match(text, /Made a topic for: ScentSell/)
  assert.match(text, /Already had one: NotRealSmart/)
  assert.match(text, /no need to pick one first/)
})

test('a failure names the project and the reason', () => {
  const text = describeTopicSetup({
    created: [],
    existing: [],
    failed: [{ name: 'ScentSell', reason: 'not enough rights' }],
  })
  assert.match(text, /ScentSell \(not enough rights\)/)
})

test('says so plainly when there is nothing to set up', () => {
  assert.match(describeTopicSetup({ created: [], existing: [], failed: [] }), /Nothing to set up/)
})
