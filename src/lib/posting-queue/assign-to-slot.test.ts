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
 * The rewrite this file guards.
 *
 * `assignToSlot` and `unassignFromSlot` wrote `queue_slot_id` and had zero
 * callers, which is why the posting-schedule page promised something no code
 * delivered. Queueing belongs to the publisher's own queue, which locks the
 * slot when it assigns it. If either name comes back here, the promise on that
 * page has quietly become a lie again.
 */
test('the dead slot-assignment writer stays gone', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'assign-to-slot.ts'), 'utf8')
  const exported = source.match(/^export\s+(?:async\s+)?function\s+(\w+)/gm) ?? []
  assert.deepEqual(
    exported.map((line) => line.split(/\s+/).pop()),
    ['nextOccurrence', 'earliestNextSlot'],
    'assign-to-slot.ts may only export the date arithmetic the composer reads for its hint',
  )
  // The history is described in the docblock on purpose, so the match is for a
  // write — `queue_slot_id:` in an update payload — not for the words.
  assert.ok(
    !/queue_slot_id\s*[:=]/.test(source),
    'nothing here may write queue_slot_id — the publisher queue owns slot assignment',
  )
})
