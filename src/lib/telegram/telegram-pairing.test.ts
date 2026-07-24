import assert from 'node:assert/strict'
import test from 'node:test'
import { hashTelegramPairCode, newTelegramPairCode } from './telegram-pairing.ts'

test('Telegram pairing codes are high-entropy, URL-safe and only persisted as a hash', () => {
  const code = newTelegramPairCode(() => Buffer.from('a'.repeat(24)))

  assert.match(code, /^[a-f0-9]{48}$/)
  assert.notEqual(hashTelegramPairCode(code), code)
  assert.equal(hashTelegramPairCode(code), hashTelegramPairCode(code))
})
