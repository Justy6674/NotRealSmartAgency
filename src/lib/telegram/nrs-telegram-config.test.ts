import assert from 'node:assert/strict'
import test from 'node:test'
import { getNRSTelegramConfig } from './nrs-telegram-config.ts'

test('configures a channel without a hard-coded NRS owner identity', () => {
  const config = getNRSTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_SECRET_TOKEN: 'webhook-secret',
    NRS_TELEGRAM_CHANNEL_ENABLED: 'true',
  })

  assert.deepEqual(config, {
    botToken: 'bot-token',
    webhookSecret: 'webhook-secret',
    enabled: true,
  })
})

test('keeps the channel fail-closed unless the explicit enable switch is true', () => {
  assert.deepEqual(getNRSTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_WEBHOOK_SECRET_TOKEN: 'webhook-secret',
  }), {
    botToken: 'bot-token',
    webhookSecret: 'webhook-secret',
    enabled: false,
  })

  assert.equal(getNRSTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'bot-token',
  }), null)
})
