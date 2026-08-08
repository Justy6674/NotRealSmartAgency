import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keepTyping, sendTypingAction } from './typing'

function recorder(fail = false) {
  const calls: Array<Record<string, unknown>> = []
  const fetchImpl = (async (_url: string, init: { body: string }) => {
    if (fail) throw new Error('network')
    calls.push(JSON.parse(init.body))
    return { ok: true, json: async () => ({ ok: true }) }
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

/** A controllable clock, so the test does not wait four seconds per tick. */
function fakeTimers() {
  let handler: (() => void) | null = null
  let cleared = false
  const setIntervalImpl = ((fn: () => void) => { handler = fn; return 1 as unknown as NodeJS.Timeout }) as typeof setInterval
  const clearIntervalImpl = (() => { cleared = true; handler = null }) as typeof clearInterval
  return { tick: () => handler?.(), get cleared() { return cleared }, setIntervalImpl, clearIntervalImpl }
}

test('the typing action goes to the right chat and topic', async () => {
  const { calls, fetchImpl } = recorder()
  await sendTypingAction({ botToken: 't', chatId: '-100', threadId: 30, fetchImpl })

  assert.equal(calls[0].action, 'typing')
  assert.equal(calls[0].chat_id, '-100')
  assert.equal(calls[0].message_thread_id, 30)
})

test('outside a topic it carries no thread', async () => {
  const { calls, fetchImpl } = recorder()
  await sendTypingAction({ botToken: 't', chatId: '555', fetchImpl })
  assert.ok(!('message_thread_id' in calls[0]))
})

test('it shows immediately, without waiting for the first interval', () => {
  const { calls, fetchImpl } = recorder()
  const timers = fakeTimers()
  keepTyping({ botToken: 't', chatId: '-100', fetchImpl, ...timers })

  // A job that starts thinking must look like it started thinking.
  assert.equal(calls.length, 1)
})

test('it keeps refreshing, because Telegram drops it after about five seconds', () => {
  const { calls, fetchImpl } = recorder()
  const timers = fakeTimers()
  keepTyping({ botToken: 't', chatId: '-100', fetchImpl, ...timers })

  timers.tick()
  timers.tick()
  assert.equal(calls.length, 3)
})

test('stopping ends it, and stopping twice is harmless', () => {
  const { calls, fetchImpl } = recorder()
  const timers = fakeTimers()
  const handle = keepTyping({ botToken: 't', chatId: '-100', fetchImpl, ...timers })

  handle.stop()
  handle.stop()
  assert.equal(timers.cleared, true)
  assert.equal(calls.length, 1, 'nothing more is sent after stopping')
})

test('a job that never finishes cannot leave it running forever', () => {
  const { fetchImpl } = recorder()
  const timers = fakeTimers()
  keepTyping({ botToken: 't', chatId: '-100', maxMs: -1, fetchImpl, ...timers })

  timers.tick()
  assert.equal(timers.cleared, true)
})

test('a failed typing call is swallowed — it must never break the work', async () => {
  const { fetchImpl } = recorder(true)
  await assert.doesNotReject(() => sendTypingAction({ botToken: 't', chatId: '-100', fetchImpl }))

  const timers = fakeTimers()
  assert.doesNotThrow(() => keepTyping({ botToken: 't', chatId: '-100', fetchImpl, ...timers }))
})
