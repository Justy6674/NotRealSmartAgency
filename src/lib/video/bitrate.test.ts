import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  bitrateForDuration, longestThatFits, MAX_VIDEO_BITRATE_KBPS, MIN_VIDEO_BITRATE_KBPS,
} from './bitrate'

const MB = 1024 * 1024
const LIMIT = 80 * MB

/** What a capped encode of `seconds` at `kbps` actually weighs. */
const bytesFor = (seconds: number, kbps: number) => ((kbps + 128) * 1000 * seconds) / 8

test("the owner's own clip now fits, where a fixed cap put it 13 MB over", () => {
  // 78 caption lines, roughly two and a half minutes. At a flat 4500 kbps it
  // came out at 93.3 MB against an 80 MB limit.
  const seconds = 166
  const plan = bitrateForDuration(seconds, LIMIT)
  assert.ok(plan.fits)
  assert.ok(bytesFor(seconds, plan.videoKbps) <= LIMIT,
    `still over: ${(bytesFor(seconds, plan.videoKbps) / MB).toFixed(1)} MB`)
})

test('a short clip is not needlessly starved', () => {
  // Thirty seconds fits easily, so it should get the full quality ceiling.
  assert.equal(bitrateForDuration(30, LIMIT).videoKbps, MAX_VIDEO_BITRATE_KBPS)
})

test('nothing ever exceeds the ceiling, however short', () => {
  for (const seconds of [1, 5, 15]) {
    assert.ok(bitrateForDuration(seconds, LIMIT).videoKbps <= MAX_VIDEO_BITRATE_KBPS)
  }
})

test('a clip too long to fit says so instead of shipping mush', () => {
  // Twenty minutes cannot fit under 80 MB at a watchable rate. Dropping the
  // bitrate far enough would technically succeed and look terrible, which is
  // its own failure — the caller has to be told.
  const plan = bitrateForDuration(20 * 60, LIMIT)
  assert.equal(plan.fits, false)
  assert.equal(plan.videoKbps, MIN_VIDEO_BITRATE_KBPS, 'must floor rather than go lower')
})

test('the size always lands under the limit while it still fits', () => {
  for (let seconds = 10; seconds <= longestThatFits(LIMIT); seconds += 17) {
    const plan = bitrateForDuration(seconds, LIMIT)
    assert.ok(plan.fits, `${seconds}s reported as not fitting`)
    assert.ok(bytesFor(seconds, plan.videoKbps) <= LIMIT,
      `${seconds}s → ${(bytesFor(seconds, plan.videoKbps) / MB).toFixed(1)} MB, over the limit`)
  }
})

test('an unknown duration does not silently starve the encode', () => {
  // ffprobe failing is not a reason to publish a smeared video.
  assert.equal(bitrateForDuration(0, LIMIT).videoKbps, MAX_VIDEO_BITRATE_KBPS)
  assert.equal(bitrateForDuration(Number.NaN, LIMIT).videoKbps, MAX_VIDEO_BITRATE_KBPS)
})

test('the longest clip that fits is a usable number to tell someone', () => {
  const seconds = longestThatFits(LIMIT)
  assert.ok(seconds > 60 && seconds < 20 * 60, `implausible: ${seconds}s`)
  assert.equal(bitrateForDuration(seconds, LIMIT).fits, true)
  assert.equal(bitrateForDuration(seconds + 60, LIMIT).fits, false)
})
