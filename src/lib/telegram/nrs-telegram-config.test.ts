import assert from 'node:assert/strict'
import test from 'node:test'
import { getNRSTelegramConfig } from './nrs-telegram-config.ts'

test('keeps the Telegram caller identity separate from the NRS account identity', () => {
  const config = getNRSTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_SECRET_TOKEN: 'webhook-secret',
    NRS_TELEGRAM_OWNER_CHAT_ID: '8123637329',
    NRS_TELEGRAM_OWNER_USER_ID: '8123637329',
    NRS_TELEGRAM_OWNER_NRS_USER_ID: '11111111-1111-4111-8111-111111111111',
  })

  assert.deepEqual(config, {
    botToken: 'bot-token',
    webhookSecret: 'webhook-secret',
    ownerTelegramChatId: '8123637329',
    ownerTelegramUserId: '8123637329',
    ownerNrsUserId: '11111111-1111-4111-8111-111111111111',
  })
})

test('does not configure the bot when the NRS owner account is missing', () => {
  assert.equal(getNRSTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_SECRET_TOKEN: 'webhook-secret',
    NRS_TELEGRAM_OWNER_CHAT_ID: '8123637329',
    NRS_TELEGRAM_OWNER_USER_ID: '8123637329',
  }), null)
})
