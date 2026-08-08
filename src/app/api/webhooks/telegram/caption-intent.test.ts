import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseScopedTelegramIntent } from '@/lib/telegram/scoped-telegram'

/**
 * A photo's words are in its caption, and dropping them dropped the photo.
 *
 * The intent was parsed from `message.text`, which a photo does not have — so
 * a carousel sent with a full brief attached parsed as "ignore" and was
 * discarded at the gate, never reaching the attachment handler further down.
 * From the outside it looked like the bot simply refused to answer.
 */
const route = readFileSync(
  resolve(process.cwd(), 'src/app/api/webhooks/telegram/route.ts'),
  'utf8',
)

test('the caption is used when a message has no text of its own', () => {
  assert.match(route, /inbound\.attachment\.caption/,
    'the caption must reach the intent parser or every photo is dropped')
})

test('a file with no words at all still counts as a request', () => {
  // "Here, do something with this" is a real request. Discarding it for having
  // nothing to parse is how footage filmed on a phone never arrived.
  assert.match(route, /Have a look at this\./)
})

test('a caption parses as a marketing request, not as noise', () => {
  const intent = parseScopedTelegramIntent('Do a post on this — the lists are free', undefined)
  assert.equal(intent.kind, 'marketing_request')
})

test('an empty parse is still ignored, so nothing else changed', () => {
  // The gate itself is right — it was being fed the wrong thing.
  assert.equal(parseScopedTelegramIntent(undefined, undefined).kind, 'ignore')
  assert.equal(parseScopedTelegramIntent('   ', undefined).kind, 'ignore')
})
