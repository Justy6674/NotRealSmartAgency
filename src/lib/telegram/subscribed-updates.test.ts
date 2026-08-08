import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SUBSCRIBED_UPDATES, missingUpdates } from './subscribed-updates'

test('an empty subscription is Telegram\'s default set, which has no reactions', () => {
  // This is the trap. `allowed_updates: []` reads as "everything" and means
  // "the default set" — reactions excluded. The emoji learning the owner asked
  // for could never have received one event, and it looked like nobody had
  // reacted.
  assert.deepEqual(missingUpdates([]), ['message_reaction'])
  assert.deepEqual(missingUpdates(undefined), ['message_reaction'])
})

test('reactions must be listed explicitly to arrive', () => {
  assert.ok(SUBSCRIBED_UPDATES.includes('message_reaction'))
  assert.deepEqual(missingUpdates(['message', 'my_chat_member']), ['message_reaction'])
})

test('a full subscription is missing nothing', () => {
  assert.deepEqual(missingUpdates([...SUBSCRIBED_UPDATES]), [])
})

test('an edited message still reaches NRS', () => {
  // Correcting a typo rather than resending is how people use Telegram; the
  // default set includes it, but re-registering explicitly would drop it.
  assert.ok(SUBSCRIBED_UPDATES.includes('edited_message'))
})
