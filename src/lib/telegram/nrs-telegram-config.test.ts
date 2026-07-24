import assert from 'node:assert/strict'
import test from 'node:test'
import { getNRSTelegramConfig } from './nrs-telegram-config.ts'

test('configures the NRS channel only from NRS-specific credentials', () => {
  const config = getNRSTelegramConfig({
    NRS_TELEGRAM_BOT_TOKEN: 'nrs-bot-token',
    NRS_TELEGRAM_WEBHOOK_SECRET_TOKEN: 'nrs-webhook-secret',
    NRS_TELEGRAM_CHANNEL_ENABLED: 'true',
  })

  assert.deepEqual(config, {
    botToken: 'nrs-bot-token',
    webhookSecret: 'nrs-webhook-secret',
    enabled: true,
  })
})

test('refuses legacy generic Telegram credentials and remains fail-closed', () => {
  assert.equal(getNRSTelegramConfig({
    TELEGRAM_BOT_TOKEN: 'downscale-bot-token',
    TELEGRAM_WEBHOOK_SECRET_TOKEN: 'downscale-webhook-secret',
    NRS_TELEGRAM_CHANNEL_ENABLED: 'true',
  }), null)

  assert.deepEqual(getNRSTelegramConfig({
    NRS_TELEGRAM_BOT_TOKEN: 'nrs-bot-token',
    NRS_TELEGRAM_WEBHOOK_SECRET_TOKEN: 'nrs-webhook-secret',
  }), {
    botToken: 'nrs-bot-token',
    webhookSecret: 'nrs-webhook-secret',
    enabled: false,
  })

  assert.equal(getNRSTelegramConfig({
    NRS_TELEGRAM_BOT_TOKEN: 'nrs-bot-token',
  }), null)
})
