import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  telegramApiBase,
  usingSelfHostedBotApi,
  telegramFileLimitBytes,
  TELEGRAM_CLOUD_FILE_LIMIT_BYTES,
  TELEGRAM_LOCAL_FILE_LIMIT_BYTES,
} from './telegram-media'

/**
 * No file had EVER arrived through the bot. Not a code fault: a phone video is
 * 200 MB+ and Telegram's cloud bot API refuses to serve a bot anything over
 * 20 MB, so every real clip was rejected before any NRS code ran. A self-hosted
 * Bot API server lifts the ceiling to 2 GB.
 */

test('defaults to Telegram cloud, with its 20MB ceiling', () => {
  assert.equal(telegramApiBase({}), 'https://api.telegram.org')
  assert.equal(usingSelfHostedBotApi({}), false)
  assert.equal(telegramFileLimitBytes({}), TELEGRAM_CLOUD_FILE_LIMIT_BYTES)
})

test('a self-hosted server raises the ceiling to 2GB', () => {
  const env = { TELEGRAM_API_BASE: 'https://tg.notrealsmart.com.au' }
  assert.equal(usingSelfHostedBotApi(env), true)
  assert.equal(telegramFileLimitBytes(env), TELEGRAM_LOCAL_FILE_LIMIT_BYTES)
})

test("the owner's actual 224MB video fits only on a self-hosted server", () => {
  const video = 224 * 1024 * 1024
  assert.ok(video > telegramFileLimitBytes({}), 'cloud must reject it')
  assert.ok(
    video < telegramFileLimitBytes({ TELEGRAM_API_BASE: 'https://tg.x' }),
    'self-hosted must accept it',
  )
})

test('a trailing slash on the base URL does not double up', () => {
  assert.equal(
    telegramApiBase({ TELEGRAM_API_BASE: 'https://tg.x/' }),
    'https://tg.x',
  )
})
