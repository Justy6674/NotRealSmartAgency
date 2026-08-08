import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTelegramJobTurn, buildTelegramModelMessages } from './telegram-thread'

/**
 * "Why can't I have a normal conversation and have it remember?"
 *
 * It could — eight turns of it — but the history had holes in exactly the
 * places that mattered: any turn where NRS spoke first was dropped, any turn
 * that failed was dropped, and what the Director actually DID was never
 * recorded at all. It could read its own prose and had no evidence of its own
 * actions, which is how one request became six drafts.
 */

test('a turn where NRS spoke first is kept', () => {
  // Upload acknowledgements, questions it asked, "working on it" — all of it
  // used to vanish, leaving answers in the history with no question above them.
  const turn = parseTelegramJobTurn({
    id: 'j1',
    input: { message: '' },
    result: { response: 'Got the photo for Scent Sell. Reading it now.' },
    completed_at: '2026-08-08T10:00:00Z',
    status: 'done',
  })
  assert.ok(turn, 'a turn NRS started is still a turn')
  assert.equal(turn!.userMessage, '')
})

test('a failed turn is kept, because "try again" needs a referent', () => {
  const turn = parseTelegramJobTurn({
    id: 'j2',
    input: { message: 'Draft the post' },
    result: null,
    completed_at: '2026-08-08T10:01:00Z',
    status: 'error',
  })
  assert.ok(turn)
  assert.equal(turn!.failed, true)
  const messages = buildTelegramModelMessages([turn!], 'try again')
  assert.match(messages[1].content, /that attempt failed/,
    'silence about a failure the owner watched happen reads as it never happening')
})

test('a turn with nothing on either side is still dropped', () => {
  assert.equal(parseTelegramJobTurn({
    id: 'j3', input: { message: '' }, result: {}, completed_at: '2026-08-08T10:00:00Z',
  }), null)
})

test('WHAT IT DID travels with what it said', () => {
  // The fix for six drafts from one request.
  const turn = parseTelegramJobTurn({
    id: 'j4',
    input: { message: 'Do a FB and Insta post' },
    result: {
      response: 'Done, both drafts created.',
      actions: ['draft_post (instagram)', 'draft_post (facebook)'],
    },
    completed_at: '2026-08-08T10:02:00Z',
    status: 'done',
  })
  const messages = buildTelegramModelMessages([turn!], 'you did them already')
  const assistant = messages.find((m) => m.role === 'assistant')!
  assert.match(assistant.content, /what I actually did/)
  assert.match(assistant.content, /draft_post \(instagram\)/)
})

test('the current message is always last', () => {
  const turn = parseTelegramJobTurn({
    id: 'j5',
    input: { message: 'earlier' },
    result: { response: 'earlier answer' },
    completed_at: '2026-08-08T10:00:00Z',
    status: 'done',
  })
  const messages = buildTelegramModelMessages([turn!], 'the new thing')
  assert.equal(messages[messages.length - 1].content, 'the new thing')
  assert.equal(messages[messages.length - 1].role, 'user')
})

test('history stays in order, oldest first', () => {
  const turns = ['first', 'second', 'third'].map((word, i) => parseTelegramJobTurn({
    id: `j${i}`,
    input: { message: word },
    result: { response: `${word} answer` },
    completed_at: `2026-08-08T10:0${i}:00Z`,
    status: 'done',
  })!)
  const messages = buildTelegramModelMessages(turns, 'now')
  assert.equal(messages[0].content, 'first')
  assert.equal(messages[4].content, 'third')
})
