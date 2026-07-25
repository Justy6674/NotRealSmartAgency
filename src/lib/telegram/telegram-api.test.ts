import assert from 'node:assert/strict'
import test from 'node:test'
import { sendTelegramText, setTelegramChatMenuButton } from './telegram-api.ts'

test('configures the NRS Mini App as Telegram private-chat menu button', async () => {
  let body: Record<string, unknown> | null = null
  await setTelegramChatMenuButton({
    botToken: 'bot-token',
    url: 'https://www.notrealsmart.com.au/telegram',
    fetchImpl: async (_url, init) => {
      body = JSON.parse(String(init?.body))
      return new Response('{}', { status: 200 })
    },
  })
  assert.deepEqual(body, {
    menu_button: {
      type: 'web_app',
      text: 'Open NRS',
      web_app: { url: 'https://www.notrealsmart.com.au/telegram' },
    },
  })
})

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

test('sends an inline project picker so selection carries an opaque grant ID', async () => {
  const calls: Array<{ body: Record<string, unknown> }> = []

  await sendTelegramText({
    botToken: 'bot-token',
    chatId: '12345',
    text: 'Choose a project.',
    replyMarkup: {
      inline_keyboard: [[{ text: 'Do Today', callback_data: 'nrs_project:grant-id' }]],
    },
    fetchImpl: async (_url, init) => {
      calls.push({ body: JSON.parse(String(init?.body)) })
      return new Response('{}', { status: 200 })
    },
  })

  assert.deepEqual(calls[0].body.reply_markup, {
    inline_keyboard: [[{ text: 'Do Today', callback_data: 'nrs_project:grant-id' }]],
  })
})
