import assert from 'node:assert/strict'
import test from 'node:test'
import { TELEGRAM_CHANNEL_STATUS, telegramChannelCanProcessMarketing } from './telegram-channel-status.ts'

test('Telegram cannot process marketing until scoped channel grants exist', () => {
  assert.equal(TELEGRAM_CHANNEL_STATUS, 'disabled_pending_scoped_channel_migration')
  assert.equal(telegramChannelCanProcessMarketing(), false)
})
