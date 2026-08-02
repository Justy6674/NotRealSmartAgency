import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendTelegramAlbum, sendTelegramText, TELEGRAM_ALBUM_LIMIT } from './telegram-api'

function recorder(responses: Array<{ ok: boolean; status?: number; description?: string }> = []) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  let index = 0
  const fetchImpl = (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) })
    const next = responses[index++] ?? { ok: true }
    return {
      ok: next.ok,
      status: next.status ?? (next.ok ? 200 : 400),
      json: async () => (next.ok ? { ok: true } : { ok: false, description: next.description }),
    }
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

test('an album is sent as one media group with the caption on the first item only', async () => {
  const { calls, fetchImpl } = recorder()

  const result = await sendTelegramAlbum({
    botToken: 'token',
    chatId: '-100123',
    items: [
      { url: 'https://x/1.jpg', kind: 'photo' },
      { url: 'https://x/2.jpg', kind: 'photo' },
    ],
    caption: 'ScentSell — 2 files.',
    fetchImpl,
  })

  assert.equal(result.sent, 2)
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /sendMediaGroup$/)
  const media = calls[0].body.media as Array<Record<string, unknown>>
  assert.equal(media[0].caption, 'ScentSell — 2 files.')
  assert.equal(media[1].caption, undefined)
})

test('more than ten slides go as several groups, captioned once', async () => {
  const { calls, fetchImpl } = recorder()
  const items = Array.from({ length: 12 }, (_, i) => ({ url: `https://x/${i}.jpg`, kind: 'photo' as const }))

  const result = await sendTelegramAlbum({
    botToken: 'token',
    chatId: '-100123',
    items,
    caption: 'twelve',
    fetchImpl,
  })

  assert.equal(result.sent, 12)
  assert.equal(calls.length, 2)
  assert.equal((calls[0].body.media as unknown[]).length, TELEGRAM_ALBUM_LIMIT)
  assert.equal((calls[1].body.media as unknown[]).length, 2)
  const second = calls[1].body.media as Array<Record<string, unknown>>
  assert.equal(second[0].caption, undefined, 'the caption must not repeat halfway through')
})

test('an album goes to the topic it was asked for', async () => {
  const { calls, fetchImpl } = recorder()

  await sendTelegramAlbum({
    botToken: 'token',
    chatId: '-100123',
    items: [{ url: 'https://x/1.jpg', kind: 'photo' }],
    threadId: 47,
    fetchImpl,
  })

  assert.equal(calls[0].body.message_thread_id, 47)
})

test('a refused album reports the reason instead of throwing', async () => {
  const { fetchImpl } = recorder([{ ok: false, description: 'WEBPAGE_CURL_FAILED' }])

  const result = await sendTelegramAlbum({
    botToken: 'token',
    chatId: '-100123',
    items: [{ url: 'https://x/1.jpg', kind: 'photo' }],
    fetchImpl,
  })

  assert.equal(result.sent, 0)
  assert.equal(result.error, 'WEBPAGE_CURL_FAILED')
})

test('one refused batch does not discard the batch that worked', async () => {
  const { fetchImpl } = recorder([{ ok: true }, { ok: false, description: 'too big' }])
  const items = Array.from({ length: 11 }, (_, i) => ({ url: `https://x/${i}.jpg`, kind: 'photo' as const }))

  const result = await sendTelegramAlbum({ botToken: 'token', chatId: '-1', items, fetchImpl })

  assert.equal(result.sent, TELEGRAM_ALBUM_LIMIT)
  assert.equal(result.error, 'too big')
})

test('nothing to send makes no call at all', async () => {
  const { calls, fetchImpl } = recorder()
  const result = await sendTelegramAlbum({ botToken: 'token', chatId: '-1', items: [], fetchImpl })
  assert.equal(result.sent, 0)
  assert.equal(calls.length, 0)
})

test('text replies carry the topic so they land in the project thread', async () => {
  const { calls, fetchImpl } = recorder()

  await sendTelegramText({ botToken: 'token', chatId: '-100123', text: 'done', threadId: 12, fetchImpl })

  assert.equal(calls[0].body.message_thread_id, 12)
})

test('a private reply carries no topic', async () => {
  const { calls, fetchImpl } = recorder()

  await sendTelegramText({ botToken: 'token', chatId: '555', text: 'done', fetchImpl })

  assert.ok(!('message_thread_id' in calls[0].body))
})
