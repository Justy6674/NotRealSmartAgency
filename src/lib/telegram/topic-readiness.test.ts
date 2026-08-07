import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkTopicReadiness, getBotId } from './topic-readiness'

/**
 * Every one of these conditions comes back from Telegram as an indistinguishable
 * "Bad Request" if you simply attempt createForumTopic. The whole point is to
 * name the ONE thing to go and fix.
 */
function api(responses: Record<string, unknown>) {
  const fetchImpl = (async (url: string) => {
    const method = String(url).split('/bot')[1]?.split('?')[0]?.split('/')[1] ?? ''
    const payload = responses[method]
    if (payload === undefined) return { json: async () => ({ ok: false }) }
    return { json: async () => payload }
  }) as unknown as typeof fetch
  return fetchImpl
}

const READY = {
  getChat: { ok: true, result: { type: 'supergroup', is_forum: true, title: 'Justin & Bec' } },
  getChatMember: { ok: true, result: { status: 'administrator', can_manage_topics: true } },
}

test('an admin with the topic right in a forum is ready', async () => {
  const result = await checkTopicReadiness({ botToken: 't', chatId: '-100', botId: 1, fetchImpl: api(READY) })
  assert.deepEqual(result, { ready: true })
})

test('the group creator is ready without an explicit right', async () => {
  const result = await checkTopicReadiness({
    botToken: 't', chatId: '-100', botId: 1,
    fetchImpl: api({ ...READY, getChatMember: { ok: true, result: { status: 'creator' } } }),
  })
  assert.equal(result.ready, true)
})

test('topics switched off names the exact menu to open', async () => {
  const result = await checkTopicReadiness({
    botToken: 't', chatId: '-100', botId: 1,
    fetchImpl: api({ ...READY, getChat: { ok: true, result: { type: 'supergroup', is_forum: false } } }),
  })
  assert.equal(result.blocker, 'topics_not_enabled')
  assert.match(result.instruction!, /Edit → Topics/)
})

test('not an admin is distinguished from admin-without-the-right', async () => {
  const notAdmin = await checkTopicReadiness({
    botToken: 't', chatId: '-100', botId: 1,
    fetchImpl: api({ ...READY, getChatMember: { ok: true, result: { status: 'member' } } }),
  })
  assert.equal(notAdmin.blocker, 'bot_not_admin')
  assert.match(notAdmin.instruction!, /add me/)

  const noRight = await checkTopicReadiness({
    botToken: 't', chatId: '-100', botId: 1,
    fetchImpl: api({ ...READY, getChatMember: { ok: true, result: { status: 'administrator', can_manage_topics: false } } }),
  })
  assert.equal(noRight.blocker, 'bot_cannot_manage_topics')
  assert.match(noRight.instruction!, /switch ON "Manage Topics"/)
})

test('an admin whose right is simply absent is treated as not having it', async () => {
  // Telegram omits the field rather than sending false. Treating "absent" as
  // permitted would produce a confident attempt that then fails.
  const result = await checkTopicReadiness({
    botToken: 't', chatId: '-100', botId: 1,
    fetchImpl: api({ ...READY, getChatMember: { ok: true, result: { status: 'administrator' } } }),
  })
  assert.equal(result.blocker, 'bot_cannot_manage_topics')
})

test('being removed from the group reads as not being in it', async () => {
  for (const status of ['left', 'kicked']) {
    const result = await checkTopicReadiness({
      botToken: 't', chatId: '-100', botId: 1,
      fetchImpl: api({ ...READY, getChatMember: { ok: true, result: { status } } }),
    })
    assert.equal(result.blocker, 'bot_not_in_chat', `${status} must read as not in the chat`)
  }
})

test('a private chat is not somewhere topics can exist', async () => {
  const result = await checkTopicReadiness({
    botToken: 't', chatId: '55', botId: 1,
    fetchImpl: api({ ...READY, getChat: { ok: true, result: { type: 'private' } } }),
  })
  assert.equal(result.blocker, 'not_a_group')
})

test('a chat the bot cannot see at all reads as not being in it', async () => {
  const result = await checkTopicReadiness({
    botToken: 't', chatId: '-100', botId: 1,
    fetchImpl: api({ getChat: { ok: false, description: 'chat not found' } }),
  })
  assert.equal(result.blocker, 'bot_not_in_chat')
})

test('a network failure says try again rather than blaming a setting', async () => {
  const fetchImpl = (async () => { throw new Error('network') }) as unknown as typeof fetch
  const result = await checkTopicReadiness({ botToken: 't', chatId: '-100', botId: 1, fetchImpl })
  assert.equal(result.blocker, 'unknown')
  assert.match(result.instruction!, /Try again/)
})

test('every blocker carries something to actually do', async () => {
  const cases = [
    { getChat: { ok: true, result: { type: 'private' } } },
    { ...READY, getChat: { ok: true, result: { type: 'supergroup', is_forum: false } } },
    { ...READY, getChatMember: { ok: true, result: { status: 'member' } } },
    { ...READY, getChatMember: { ok: true, result: { status: 'administrator' } } },
  ]
  for (const responses of cases) {
    const result = await checkTopicReadiness({ botToken: 't', chatId: '-100', botId: 1, fetchImpl: api(responses) })
    assert.equal(result.ready, false)
    assert.ok(result.instruction && result.instruction.length > 20, 'an instruction must be actionable')
  }
})

test('the bot can find out its own id', async () => {
  assert.equal(await getBotId('t', api({ getMe: { ok: true, result: { id: 8831381020 } } })), 8831381020)
  assert.equal(await getBotId('t', api({ getMe: { ok: false } })), null)
})
