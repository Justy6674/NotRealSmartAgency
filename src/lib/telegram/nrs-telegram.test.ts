import assert from 'node:assert/strict'
import test from 'node:test'
import {
  authoriseTelegramUpdate,
  resolveTelegramBrand,
  splitTelegramMessage,
  type TelegramUpdate,
} from './nrs-telegram.ts'

const OWNER = {
  chatId: '12345',
  userId: '12345',
}

const textUpdate = (text: string): TelegramUpdate => ({
  update_id: 1,
  message: {
    message_id: 2,
    chat: { id: 12345, type: 'private' },
    from: { id: 12345, is_bot: false },
    text,
  },
})

test('accepts only a signed update from the configured owner chat', () => {
  assert.deepEqual(authoriseTelegramUpdate({
    update: textUpdate('Create a DoToday launch plan'),
    suppliedSecret: 'correct-secret',
    expectedSecret: 'correct-secret',
    owner: OWNER,
  }), { ok: true, text: 'Create a DoToday launch plan' })
})

test('rejects a forged webhook and an unlinked Telegram user', () => {
  assert.equal(authoriseTelegramUpdate({
    update: textUpdate('Hello'),
    suppliedSecret: 'wrong-secret',
    expectedSecret: 'correct-secret',
    owner: OWNER,
  }).ok, false)

  const unlinked = textUpdate('Hello')
  unlinked.message.from.id = 777
  assert.equal(authoriseTelegramUpdate({
    update: unlinked,
    suppliedSecret: 'correct-secret',
    expectedSecret: 'correct-secret',
    owner: OWNER,
  }).ok, false)
})

test('rejects a malformed update before it reaches the Director queue', () => {
  const result = authoriseTelegramUpdate({
    update: { ...textUpdate('Create a DoToday launch plan'), update_id: Number.NaN },
    suppliedSecret: 'correct-secret',
    expectedSecret: 'correct-secret',
    owner: OWNER,
  })

  assert.deepEqual(result, { ok: false, reason: 'unsupported_update' })
})

test('resolves an explicitly named brand but never guesses when it is absent', () => {
  const brands = [
    { id: 'dotoday-id', name: 'DoToday', slug: 'dotoday' },
    { id: 'telescribe-id', name: 'TeleScribe', slug: 'telescribe' },
  ]

  assert.deepEqual(resolveTelegramBrand('Build a launch week for DoToday', brands), {
    kind: 'matched',
    brand: brands[0],
  })
  assert.deepEqual(resolveTelegramBrand('Build a launch week for Do Today', brands), {
    kind: 'matched',
    brand: brands[0],
  })
  assert.deepEqual(resolveTelegramBrand('Make a marketing plan', brands), {
    kind: 'needs_brand',
  })
})

test('splits a Director response at Telegrams message limit without losing text', () => {
  const response = `${'A'.repeat(4090)}\n${'B'.repeat(20)}`
  const chunks = splitTelegramMessage(response)

  assert.deepEqual(chunks, ['A'.repeat(4090), 'B'.repeat(20)])
  assert.ok(chunks.every((chunk) => chunk.length <= 4096))
})
