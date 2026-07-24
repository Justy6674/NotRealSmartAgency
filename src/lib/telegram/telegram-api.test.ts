import assert from 'node:assert/strict'
import test from 'node:test'
import { sendTelegramText } from './telegram-api.ts'

test('sends each response chunk through Telegrams sendMessage API without HTML parsing', async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = []

  await sendTelegramText({
    botToken: 'bot-token',
    chatId: '12345',
    text: `${'A'.repeat(4090)}\n${'B'.repeat(20)}`,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    },
  })

  assert.equal(requests.length, 2)
  assert.equal(requests[0].url, 'https://api.telegram.org/botbot-token/sendMessage')
  assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
    chat_id: '12345',
    text: 'A'.repeat(4090),
    disable_web_page_preview: true,
  })
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), {
    chat_id: '12345',
    text: 'B'.repeat(20),
    disable_web_page_preview: true,
  })
})

test('surfaces a Telegram delivery failure instead of silently dropping a Director response', async () => {
  await assert.rejects(
    sendTelegramText({
      botToken: 'bot-token',
      chatId: '12345',
      text: 'Hello',
      fetchImpl: async () => new Response('Bad Gateway', { status: 502 }),
    }),
    /Telegram sendMessage failed: 502/,
  )
})
