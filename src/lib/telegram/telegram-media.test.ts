import assert from 'node:assert/strict'
import test from 'node:test'
import { acknowledgeAttachment, readAttachment, TELEGRAM_FILE_LIMIT_BYTES } from './telegram-media.ts'

test('a video sent as media is recognised', () => {
  // The bot ignored anything that was not text, so a video sent to it simply
  // vanished — no error, no file.
  const a = readAttachment({ video: { file_id: 'v1', file_size: 900, mime_type: 'video/mp4' }, caption: 'swap demo' })
  assert.equal(a?.kind, 'video')
  assert.equal(a?.fileId, 'v1')
  assert.equal(a?.caption, 'swap demo')
})

test('a video sent as a file is still a video', () => {
  const a = readAttachment({ document: { file_id: 'd1', mime_type: 'video/quicktime' } })
  assert.equal(a?.kind, 'video')
})

test('the largest photo is taken, not the thumbnail', () => {
  // Photos arrive smallest-first; taking the first would grab a thumbnail.
  const a = readAttachment({ photo: [
    { file_id: 'small', file_size: 100 },
    { file_id: 'medium', file_size: 900 },
    { file_id: 'large', file_size: 9000 },
  ] })
  assert.equal(a?.fileId, 'large')
  assert.equal(a?.kind, 'photo')
})

test('a voice note is treated as audio', () => {
  assert.equal(readAttachment({ voice: { file_id: 'a1' } })?.kind, 'audio')
  assert.equal(readAttachment({ audio: { file_id: 'a2' } })?.kind, 'audio')
})

test('a plain text message has no attachment', () => {
  assert.equal(readAttachment({ text: 'draft me three posts' }), null)
})

test('a non-media document is not mistaken for one', () => {
  assert.equal(readAttachment({ document: { file_id: 'd', mime_type: 'application/pdf' } })?.kind, 'document')
})

test('the acknowledgement says what will happen, in his words', () => {
  const video = acknowledgeAttachment({ fileId: 'v', kind: 'video' }, 'ScentSell')
  assert.match(video, /ScentSell/)
  assert.match(video, /transcrib/i)
  assert.match(video, /what you actually said/)

  const photo = acknowledgeAttachment({ fileId: 'p', kind: 'photo' }, 'ScentSell')
  assert.ok(!photo.includes('Transcrib'), 'a photo is not transcribed')
})

test('the size limit is what Telegram actually allows a bot', () => {
  assert.equal(TELEGRAM_FILE_LIMIT_BYTES, 20 * 1024 * 1024)
})
