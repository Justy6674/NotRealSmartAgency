import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { validateTelegramMiniAppInitData } from './mini-app.ts'

function signedInitData(botToken: string, authDate: number): string {
  const user = JSON.stringify({ id: 42, first_name: 'Justin', username: 'justin' })
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAE', user })
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const hash = createHmac('sha256', secret).update(check).digest('hex')
  params.set('hash', hash)
  return params.toString()
}

test('validates Telegram Web App initData and normalises the Telegram user ID', () => {
  const auth = validateTelegramMiniAppInitData(signedInitData('bot-token', 1_700_000_000), 'bot-token', 1_700_000_100)
  assert.equal(auth?.telegramUserId, '42')
  assert.equal(auth?.user.username, 'justin')
})

test('rejects tampered and expired Telegram Web App initData', () => {
  const valid = signedInitData('bot-token', 1_700_000_000)
  assert.equal(validateTelegramMiniAppInitData(`${valid}x`, 'bot-token', 1_700_000_100), null)
  assert.equal(validateTelegramMiniAppInitData(valid, 'bot-token', 1_700_100_000), null)
})
