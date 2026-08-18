import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPostSlots } from './fill-calendar.ts'
import { bookedTimes, type WeeklyPostingTime } from '../../posting-queue/next-free-time.ts'
import type { PostPlatform } from '../../../types/database.ts'

/**
 * "Make this fortnight" fills the owner's OWN times and no others.
 *
 * The fault these pin: it used to decide a time was free by comparing the
 * network and the HOUR of anything already scheduled. A post at 9:14 did not
 * stop a second one being written for 9:00, and a time the owner had filled by
 * hand — which carries no weekly-time id at all — was invisible to it.
 */

const brisbane = 'Australia/Brisbane'

function time(
  id: string | null,
  day: number,
  clock: string,
  platform: PostPlatform,
): WeeklyPostingTime & { platform: PostPlatform } {
  return { id, day_of_week: day, time: clock, timezone: brisbane, platform }
}

// Sunday 16 Aug 2026, 10:00 in Brisbane.
const now = new Date('2026-08-16T00:00:00.000Z')

test('every filled time is an occurrence of a time the owner set', () => {
  const week = [time('mon-fb', 1, '09:00', 'facebook'), time('wed-fb', 3, '17:00', 'facebook')]
  const filled = buildPostSlots(2, 5, week, bookedTimes([]), now)

  assert.deepEqual(
    filled.map((slot) => slot.scheduledAt),
    [
      '2026-08-16T23:00:00.000Z', // Monday 9:00am Brisbane
      '2026-08-19T07:00:00.000Z', // Wednesday 5:00pm Brisbane
      '2026-08-23T23:00:00.000Z',
      '2026-08-26T07:00:00.000Z',
    ],
  )
  assert.ok(filled.every((slot) => slot.slotId === 'mon-fb' || slot.slotId === 'wed-fb'))
})

test('a time that already has a post on it is left alone', () => {
  const week = [time('mon-fb', 1, '09:00', 'facebook')]
  const taken = bookedTimes([
    { queue_slot_id: 'mon-fb', scheduled_at: '2026-08-16T23:00:00.000Z', status: 'scheduled' },
  ])
  const filled = buildPostSlots(2, 5, week, taken, now)
  assert.deepEqual(filled.map((slot) => slot.scheduledAt), ['2026-08-23T23:00:00.000Z'])
})

test('a time the owner filled by hand, with no id on it, is still taken', () => {
  const week = [time('mon-fb', 1, '09:00', 'facebook')]
  // 9:00am Monday, scheduled through "Choose a time" — no weekly-time id.
  const taken = bookedTimes([{ queue_slot_id: null, scheduled_at: '2026-08-16T23:00:20.000Z' }])
  const filled = buildPostSlots(2, 5, week, taken, now)
  assert.deepEqual(filled.map((slot) => slot.scheduledAt), ['2026-08-23T23:00:00.000Z'])
})

/**
 * One time is stored as one row per connected network, so four networks on a
 * 9:00am Tuesday is four rows and ONE posting occasion. Counting rows against
 * "posts per week" would give the owner one day of the week they asked for.
 */
test('posts per week counts occasions, not one per network', () => {
  const week = [
    time('mon-fb', 1, '09:00', 'facebook'),
    time('mon-ig', 1, '09:00', 'instagram'),
    time('wed-fb', 3, '17:00', 'facebook'),
    time('wed-ig', 3, '17:00', 'instagram'),
  ]
  const filled = buildPostSlots(1, 1, week, bookedTimes([]), now)
  const instants = [...new Set(filled.map((slot) => slot.scheduledAt))]
  assert.equal(instants.length, 1, 'one occasion in the week')
  assert.deepEqual(
    filled.map((slot) => slot.platform).sort(),
    ['facebook', 'instagram'],
    'and it goes to both networks',
  )
})

test('a week kept with the publisher fills without ids, never with invented ones', () => {
  const week = [time(null, 2, '12:00', 'instagram')]
  const filled = buildPostSlots(1, 5, week, bookedTimes([]), now)
  assert.equal(filled.length, 1)
  assert.equal(filled[0].scheduledAt, '2026-08-18T02:00:00.000Z') // Tuesday 12:00pm Brisbane
  assert.equal(filled[0].slotId, undefined)
})

test('nothing is filled past the stretch that was asked for', () => {
  const week = [time('mon-fb', 1, '09:00', 'facebook')]
  assert.equal(buildPostSlots(1, 5, week, bookedTimes([]), now).length, 1)
  assert.equal(buildPostSlots(4, 5, week, bookedTimes([]), now).length, 4)
})

test('an empty week fills nothing at all', () => {
  assert.deepEqual(buildPostSlots(4, 5, [], bookedTimes([]), now), [])
})
