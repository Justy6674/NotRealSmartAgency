import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseTimestamp, checkPlatformSupportsMedia } from './create-draft'

/**
 * These cover the exact input that killed a real Director run: it asked for an
 * unscheduled draft, sent scheduled_at as "", and Postgres rejected the whole
 * insert with "invalid input syntax for type timestamp" — throwing away three
 * platform captions it had already written.
 */

test('an empty scheduled_at falls back to now rather than reaching Postgres', () => {
  const result = normaliseTimestamp('')
  assert.ok(!Number.isNaN(new Date(result).getTime()))
})

test('whitespace-only scheduled_at falls back to now', () => {
  assert.ok(!Number.isNaN(new Date(normaliseTimestamp('   ')).getTime()))
})

test('model-speak for "no value" falls back to now', () => {
  for (const value of ['null', 'NULL', 'none', 'undefined', 'n/a']) {
    const result = normaliseTimestamp(value)
    assert.ok(
      !Number.isNaN(new Date(result).getTime()),
      `${value} should have fallen back to a valid timestamp`,
    )
  }
})

test('null and undefined fall back to now', () => {
  assert.ok(!Number.isNaN(new Date(normaliseTimestamp(null)).getTime()))
  assert.ok(!Number.isNaN(new Date(normaliseTimestamp(undefined)).getTime()))
})

test('an unparseable date falls back rather than corrupting the insert', () => {
  assert.ok(!Number.isNaN(new Date(normaliseTimestamp('next tuesday-ish')).getTime()))
})

test('a real ISO datetime is preserved', () => {
  const iso = '2026-04-07T09:00:00.000Z'
  assert.equal(normaliseTimestamp(iso), iso)
})

test('a timezone-offset datetime is preserved as the same instant', () => {
  assert.equal(
    normaliseTimestamp('2026-04-07T09:00:00+10:00'),
    new Date('2026-04-07T09:00:00+10:00').toISOString(),
  )
})

/**
 * A real Telegram album run produced an Instagram carousel, a Facebook carousel
 * and a YouTube carousel. YouTube has no image post — that draft could never
 * have published, and nothing said so until it failed.
 */
test('YouTube refuses an image carousel, with a usable reason', () => {
  const reason = checkPlatformSupportsMedia('youtube', false, 3)
  assert.ok(reason, 'should have been refused')
  assert.match(reason!, /only publishes video/)
  assert.match(reason!, /Instagram or Facebook/)
})

test('TikTok refuses images too', () => {
  assert.ok(checkPlatformSupportsMedia('tiktok', false, 1))
})

test('YouTube accepts a video', () => {
  assert.equal(checkPlatformSupportsMedia('youtube', true, 1), null)
})

test('YouTube refuses a text-only post', () => {
  const reason = checkPlatformSupportsMedia('youtube', false, 0)
  assert.match(reason!, /requires a video/)
})

test('Instagram and Facebook accept photo carousels', () => {
  assert.equal(checkPlatformSupportsMedia('instagram', false, 8), null)
  assert.equal(checkPlatformSupportsMedia('facebook', false, 3), null)
})

test('a text-only post is fine on platforms that allow it', () => {
  assert.equal(checkPlatformSupportsMedia('linkedin', false, 0), null)
  assert.equal(checkPlatformSupportsMedia('twitter', false, 0), null)
})
