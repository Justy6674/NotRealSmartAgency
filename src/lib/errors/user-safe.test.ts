import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksInternal, messageOf, relayIfSafe, userSafeError } from './user-safe'

/** The exact string the owner's colleague read as her first sight of NRS. */
const THE_ONE_SHE_SAW =
  'new row for relation "telegram_project_sessions" violates check constraint "telegram_project_sessions_check"'

test('the error that actually reached her is recognised as internal', () => {
  assert.equal(looksInternal(THE_ONE_SHE_SAW), true)
})

test('every shape of internal detail is caught', () => {
  const internal = [
    'column media_items.file_size does not exist',
    'null value in column "project_access_grant_id" violates not-null constraint',
    'duplicate key value violates unique constraint "uq_mcp_jobs_client_event_id"',
    'permission denied for table brands',
    'new row violates row-level security policy',
    'invalid input syntax for type timestamp: ""',
    'canceling statement due to statement timeout',
    'fetch failed',
    'relation "telegram_groups" does not exist',
    'TypeError: x is not a function\n    at /var/task/.next/server/chunks/123.js:1:5299',
    'Job 941fd585-1f85-4646-a1d7-e000aa0ca00a failed',
    'PostgREST returned 42703',
  ]
  for (const message of internal) {
    assert.equal(looksInternal(message), true, `must be caught: ${message}`)
  }
})

test('an ordinary sentence is not mistaken for internal detail', () => {
  const safe = [
    'Caption is too long for Instagram.',
    'That account is not connected yet.',
    'The video is still uploading.',
    'Rate limit reached — try again in a minute.',
  ]
  for (const message of safe) {
    assert.equal(looksInternal(message), false, `must NOT be caught: ${message}`)
  }
})

test('userSafeError returns only the fallback, whatever it was given', () => {
  const shown = userSafeError('test', new Error(THE_ONE_SHE_SAW), 'That could not be saved.')
  assert.equal(shown, 'That could not be saved.')
  assert.doesNotMatch(shown, /violates|constraint|relation/)
})

test('it never throws on whatever it is handed', () => {
  assert.equal(messageOf(new Error('boom')), 'boom')
  assert.equal(messageOf('boom'), 'boom')
  assert.equal(messageOf({ message: 'boom' }), 'boom')
  assert.equal(messageOf(null), 'null')
  assert.equal(messageOf(undefined), 'undefined')
  assert.equal(userSafeError('test', null, 'fallback'), 'fallback')
})

test('relayIfSafe passes a genuinely useful platform message through', () => {
  assert.equal(
    relayIfSafe('test', new Error('Caption exceeds 2200 characters.'), 'fallback'),
    'Caption exceeds 2200 characters.',
  )
})

test('relayIfSafe refuses anything internal, even though it was asked to relay', () => {
  assert.equal(relayIfSafe('test', new Error(THE_ONE_SHE_SAW), 'fallback'), 'fallback')
  assert.equal(relayIfSafe('test', new Error('column x does not exist'), 'fallback'), 'fallback')
})

test('relayIfSafe refuses a wall of text, which is never a useful message', () => {
  // A long body is a dump, not an explanation, and dumps carry internals.
  assert.equal(relayIfSafe('test', new Error('x'.repeat(400)), 'fallback'), 'fallback')
})

test('relayIfSafe falls back on an empty message rather than showing nothing', () => {
  assert.equal(relayIfSafe('test', new Error(''), 'fallback'), 'fallback')
  assert.equal(relayIfSafe('test', new Error('   '), 'fallback'), 'fallback')
})
