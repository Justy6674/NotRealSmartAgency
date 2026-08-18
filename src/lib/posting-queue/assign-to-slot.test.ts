import assert from 'node:assert/strict'
import test from 'node:test'
import { earliestNextSlot, nextOccurrence } from './assign-to-slot.ts'
import type { PostingScheduleSlot } from '../../types/database.ts'

const mondayNine: Pick<PostingScheduleSlot, 'day_of_week' | 'time' | 'timezone'> = {
  day_of_week: 1,
  time: '09:00',
  timezone: 'Australia/Brisbane',
}

test('no slots means there is no next free slot to invent', () => {
  assert.equal(earliestNextSlot([], new Date('2026-08-17T00:00:00.000Z')), null)
})

test('the next free slot is the earliest occurrence after now', () => {
  const from = new Date('2026-08-17T00:00:00.000Z') // Monday
  const when = earliestNextSlot([mondayNine], from)
  assert.ok(when)
  const expected = nextOccurrence(mondayNine, from)
  assert.equal(when.toISOString(), expected.toISOString())
})

test('Sydney slots observe daylight saving time', () => {
  const sydneyMondayNine = {
    day_of_week: 1,
    time: '09:00',
    timezone: 'Australia/Sydney',
  }

  assert.equal(
    nextOccurrence(sydneyMondayNine, new Date('2026-01-04T00:00:00.000Z')).toISOString(),
    '2026-01-04T22:00:00.000Z',
  )
  assert.equal(
    nextOccurrence(sydneyMondayNine, new Date('2026-07-05T00:00:00.000Z')).toISOString(),
    '2026-07-05T23:00:00.000Z',
  )
})
