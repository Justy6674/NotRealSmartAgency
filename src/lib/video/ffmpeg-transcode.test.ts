import assert from 'node:assert/strict'
import test from 'node:test'
import { needsDeliveryCopy, DELIVERY_MAX_BYTES } from './ffmpeg-transcode.ts'

/**
 * The video that failed was 301 MB — legal H.264 1080x1920 at 30fps, rejected
 * only because Instagram fetches the URL itself and gives up on a file that
 * size. Nothing about the format was wrong, so the gate is size, not codec.
 */

const MB = 1024 * 1024

test('a phone video too big for a platform fetch gets a delivery copy', () => {
  assert.equal(needsDeliveryCopy('video/quicktime', 301 * MB), true)
  assert.equal(needsDeliveryCopy('video/mp4', 344 * MB), true)
})

test('a video already small enough is published untouched', () => {
  // Re-encoding costs a generation of quality and four minutes, for nothing.
  assert.equal(needsDeliveryCopy('video/mp4', 12 * MB), false)
  assert.equal(needsDeliveryCopy('video/mp4', DELIVERY_MAX_BYTES), false)
  assert.equal(needsDeliveryCopy('video/mp4', DELIVERY_MAX_BYTES + 1), true)
})

test('images and audio are never transcoded, however large', () => {
  assert.equal(needsDeliveryCopy('image/jpeg', 500 * MB), false)
  assert.equal(needsDeliveryCopy('audio/mpeg', 500 * MB), false)
  assert.equal(needsDeliveryCopy(null, 500 * MB), false)
})

test('an unknown size is not assumed to need re-encoding', () => {
  assert.equal(needsDeliveryCopy('video/mp4', null), false)
})
