import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normaliseTimestamp } from './create-draft'

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
