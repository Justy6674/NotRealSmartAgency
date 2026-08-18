import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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

test('a weekly time lands on its own weekday in its own zone', () => {
  const from = new Date('2026-08-17T00:00:00.000Z')
  const when = nextOccurrence(mondayNine, from)
  // 09:00 Brisbane is 23:00 UTC the day before, so the assertion has to be
  // made in the slot's zone or it looks wrong for the right reason.
  const inZone = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Brisbane',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(when)
  assert.match(inZone, /Mon/)
  assert.match(inZone, /09:00/)
})

/**
 * Brisbane has no daylight saving, so the Brisbane case above passed against
 * the old hard-coded offset table too. The southern states are where that
 * table lied: it approximated them at standard time all year, so a Sydney
 * "9am Monday" slot was read as 10am for the five months of DST — and the
 * owner was shown the wrong hour with no hint anything was off. Two instants,
 * one either side of the transition, is the whole guard.
 */
test('Sydney slots observe daylight saving time', () => {
  const sydneyMondayNine: Pick<PostingScheduleSlot, 'day_of_week' | 'time' | 'timezone'> = {
    day_of_week: 1,
    time: '09:00',
    timezone: 'Australia/Sydney',
  }

  // Summer: Sydney is UTC+11, so 09:00 Monday is 22:00 UTC the Sunday before.
  assert.equal(
    nextOccurrence(sydneyMondayNine, new Date('2026-01-04T00:00:00.000Z')).toISOString(),
    '2026-01-04T22:00:00.000Z',
  )
  // Winter: UTC+10, so the same wall-clock slot is an hour later in UTC.
  assert.equal(
    nextOccurrence(sydneyMondayNine, new Date('2026-07-05T00:00:00.000Z')).toISOString(),
    '2026-07-05T23:00:00.000Z',
  )
})

/**
 * The rewrite this file guards.
 *
 * `assignToSlot` and `unassignFromSlot` wrote `queue_slot_id` and had zero
 * callers, which is why the posting-schedule page promised something no code
 * delivered. Queueing belongs to the publisher's own queue, which locks the
 * slot when it assigns it. The one legitimate writer is `fill-calendar.ts`,
 * going through `createDraftPost({ queueSlotId })` — the canonical draft
 * pipeline. If either name comes back HERE, there are two writers again and
 * the promise on that page has quietly become a lie.
 */
test('the dead slot-assignment writer stays gone', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'assign-to-slot.ts'), 'utf8')
  const exported = source.match(/^export\s+(?:async\s+)?function\s+(\w+)/gm) ?? []
  assert.deepEqual(
    exported.map((line) => line.split(/\s+/).pop()),
    ['nextOccurrence', 'earliestNextSlot', 'zonedDateTimeToUtc'],
    'assign-to-slot.ts may only export date arithmetic — never a slot-assignment writer',
  )
  // `zonedDateTimeToUtc` joined the list when the composer's "Choose a time"
  // picker needed to read a typed wall clock as the BUSINESS's time. It is the
  // same arithmetic `nextOccurrence` already used, exported rather than copied,
  // because a second timezone implementation is how the southern states came to
  // read an hour wrong for five months of the year. The invariant this test
  // exists for is unchanged and asserted below: nothing here writes a slot.
  // The history is described in the docblock on purpose, so the match is for a
  // write — `queue_slot_id:` in an update payload — not for the words.
  assert.ok(
    !/queue_slot_id\s*[:=]/.test(source),
    'nothing here may write queue_slot_id — the publisher queue owns slot assignment',
  )
})
