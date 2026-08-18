import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bookedTimes,
  describePostingTime,
  firstFreeInstant,
  isInThePast,
  isTaken,
  minuteKey,
  nextFreeTime,
  type WeeklyPostingTime,
} from './next-free-time.ts'

/**
 * Brisbane is a fixed UTC+10 all year, which is why the interesting cases here
 * are midnight and the week rolling over rather than daylight saving. The one
 * Sydney case at the bottom is there to prove the helpers stay general — it
 * must never be read as a reason to change what Brisbane does.
 */

const brisbane = 'Australia/Brisbane'

const mondayNine: WeeklyPostingTime = {
  id: 'slot-mon-9',
  day_of_week: 1,
  time: '09:00',
  timezone: brisbane,
}

const noBookings = bookedTimes([])

test('no posting times means there is no next free time to invent', () => {
  assert.equal(nextFreeTime([], noBookings, new Date('2026-08-16T00:00:00.000Z')), null)
})

test('the next free time is the soonest occurrence, in Brisbane wall clock', () => {
  const free = nextFreeTime([mondayNine], noBookings, new Date('2026-08-16T00:00:00.000Z'))
  assert.ok(free)
  // Monday 17 Aug 2026, 09:00 Brisbane = 23:00 UTC the day before.
  assert.equal(free.when.toISOString(), '2026-08-16T23:00:00.000Z')
  assert.equal(free.slotId, 'slot-mon-9')
  assert.equal(free.timezone, brisbane)
})

test('a time already carrying a post rolls over to the same time next week', () => {
  const booked = bookedTimes([
    { queue_slot_id: 'slot-mon-9', scheduled_at: '2026-08-16T23:00:00.000Z', status: 'scheduled' },
  ])
  const free = nextFreeTime([mondayNine], booked, new Date('2026-08-16T00:00:00.000Z'))
  assert.ok(free)
  assert.equal(free.when.toISOString(), '2026-08-23T23:00:00.000Z')
})

/**
 * A post put on a time by hand through "Choose a time" carries no slot id at
 * all. If only the slot id were checked, the button would hand a second post to
 * a minute that already has one — which is the double-booking this whole module
 * exists to prevent.
 */
test('a time taken by hand, with no slot id, is still taken', () => {
  const booked = bookedTimes([
    { queue_slot_id: null, scheduled_at: '2026-08-16T23:00:30.000Z', status: 'draft' },
  ])
  const free = nextFreeTime([mondayNine], booked, new Date('2026-08-16T00:00:00.000Z'))
  assert.ok(free)
  assert.equal(free.when.toISOString(), '2026-08-23T23:00:00.000Z')
})

test('a cancelled post gives its time back', () => {
  const booked = bookedTimes([
    { queue_slot_id: 'slot-mon-9', scheduled_at: '2026-08-16T23:00:00.000Z', status: 'cancelled' },
  ])
  const free = nextFreeTime([mondayNine], booked, new Date('2026-08-16T00:00:00.000Z'))
  assert.ok(free)
  assert.equal(free.when.toISOString(), '2026-08-16T23:00:00.000Z')
})

/**
 * Midnight is where a day boundary read in the wrong zone shows up. 00:00
 * Monday in Brisbane is 14:00 SUNDAY in UTC, so anything counting the weekday
 * off the UTC date puts this time on the wrong day and it is never chosen.
 */
test('a midnight time belongs to its own zone day, not the UTC one', () => {
  const mondayMidnight: WeeklyPostingTime = {
    id: 'slot-mon-0',
    day_of_week: 1,
    time: '00:00',
    timezone: brisbane,
  }
  const free = nextFreeTime([mondayMidnight], noBookings, new Date('2026-08-16T00:00:00.000Z'))
  assert.ok(free)
  assert.equal(free.when.toISOString(), '2026-08-16T14:00:00.000Z')
})

test('a midnight time that has just gone by waits a whole week', () => {
  const sundayMidnight: WeeklyPostingTime = {
    id: 'slot-sun-0',
    day_of_week: 0,
    time: '00:00',
    timezone: brisbane,
  }
  // 00:30 Sunday in Brisbane — half an hour after the time went.
  const free = nextFreeTime([sundayMidnight], noBookings, new Date('2026-08-15T14:30:00.000Z'))
  assert.ok(free)
  assert.equal(free.when.toISOString(), '2026-08-22T14:00:00.000Z')
})

test('the soonest time wins across the whole week, not the first one listed', () => {
  const week: WeeklyPostingTime[] = [
    { id: 'fri', day_of_week: 5, time: '17:00', timezone: brisbane },
    { id: 'tue', day_of_week: 2, time: '09:00', timezone: brisbane },
    { id: 'wed', day_of_week: 3, time: '12:00', timezone: brisbane },
  ]
  const free = nextFreeTime(week, noBookings, new Date('2026-08-16T00:00:00.000Z'))
  assert.ok(free)
  assert.equal(free.slotId, 'tue')
  // Tuesday 18 Aug, 09:00 Brisbane.
  assert.equal(free.when.toISOString(), '2026-08-17T23:00:00.000Z')
})

/**
 * One 9:00am Tuesday is stored as one row per connected network, because the
 * table's unique key includes the network. Those rows are ONE time: the answer
 * must be a single time carrying each network's id, not three competing
 * answers, and a post landing on it must take it for all of them at once.
 */
test('one time split across networks answers once, with an id for each network', () => {
  const nineAmEverywhere: WeeklyPostingTime[] = [
    { id: 'fb-row', day_of_week: 2, time: '09:00', timezone: brisbane, platform: 'facebook' },
    { id: 'ig-row', day_of_week: 2, time: '09:00', timezone: brisbane, platform: 'instagram' },
  ]
  const free = nextFreeTime(nineAmEverywhere, noBookings, new Date('2026-08-16T00:00:00.000Z'))
  assert.ok(free)
  assert.equal(free.when.toISOString(), '2026-08-17T23:00:00.000Z')
  assert.deepEqual(free.slotIdByPlatform, { facebook: 'fb-row', instagram: 'ig-row' })

  // A post taking that time takes it for every network on it — the Instagram
  // row must not be offered the minute the Facebook row is already on.
  const afterPosting = bookedTimes([
    { queue_slot_id: 'fb-row', scheduled_at: '2026-08-17T23:00:00.000Z', status: 'scheduled' },
  ])
  const next = nextFreeTime(nineAmEverywhere, afterPosting, new Date('2026-08-16T00:00:00.000Z'))
  assert.ok(next)
  assert.equal(next.when.toISOString(), '2026-08-24T23:00:00.000Z')
})

test('a week booked solid to the horizon has no free time, and says so by returning null', () => {
  const from = new Date('2026-08-16T00:00:00.000Z')
  const occupied: Array<{ queue_slot_id: string; scheduled_at: string }> = []
  for (let week = 0; week < 6; week++) {
    occupied.push({
      queue_slot_id: 'slot-mon-9',
      scheduled_at: new Date(Date.parse('2026-08-16T23:00:00.000Z') + week * 7 * 86_400_000).toISOString(),
    })
  }
  assert.equal(nextFreeTime([mondayNine], bookedTimes(occupied), from), null)
})

test('Brisbane keeps the same wall clock in January and in July', () => {
  const january = nextFreeTime([mondayNine], noBookings, new Date('2026-01-04T00:00:00.000Z'))
  const july = nextFreeTime([mondayNine], noBookings, new Date('2026-07-05T00:00:00.000Z'))
  assert.ok(january && july)
  // Both 23:00 UTC the day before — UTC+10 with no daylight saving, all year.
  assert.equal(january.when.toISOString(), '2026-01-04T23:00:00.000Z')
  assert.equal(july.when.toISOString(), '2026-07-05T23:00:00.000Z')
})

/**
 * Not a Brisbane concern, and not a reason to touch Brisbane. This is here so a
 * future business in a daylight-saving zone is not silently an hour out — the
 * conversion is Intl's, not a hard-coded offset table.
 */
test('a daylight-saving zone still lands on its own wall clock', () => {
  const sydneyMondayNine: WeeklyPostingTime = {
    id: 'sydney-mon-9',
    day_of_week: 1,
    time: '09:00',
    timezone: 'Australia/Sydney',
  }
  const summer = nextFreeTime([sydneyMondayNine], noBookings, new Date('2026-01-04T00:00:00.000Z'))
  const winter = nextFreeTime([sydneyMondayNine], noBookings, new Date('2026-07-05T00:00:00.000Z'))
  assert.ok(summer && winter)
  assert.equal(summer.when.toISOString(), '2026-01-04T22:00:00.000Z') // UTC+11
  assert.equal(winter.when.toISOString(), '2026-07-05T23:00:00.000Z') // UTC+10
})

test('taken is judged to the minute, not the second', () => {
  const booked = bookedTimes([{ scheduled_at: '2026-08-16T23:00:45.000Z' }])
  assert.equal(isTaken(null, new Date('2026-08-16T23:00:00.000Z'), booked), true)
  assert.equal(isTaken(null, new Date('2026-08-16T23:01:00.000Z'), booked), false)
  assert.equal(minuteKey('2026-08-16T23:00:45.000Z'), '2026-08-16T23:00:00.000Z')
})

test('a queue time already spoken for is skipped, and a past one is never offered', () => {
  const from = new Date('2026-08-16T00:00:00.000Z')
  const booked = bookedTimes([{ scheduled_at: '2026-08-16T23:00:00.000Z' }])
  const answer = firstFreeInstant(
    ['2026-08-15T23:00:00.000Z', '2026-08-16T23:00:00.000Z', '2026-08-17T23:00:00.000Z'],
    booked,
    from,
  )
  assert.equal(answer, '2026-08-17T23:00:00.000Z')
})

test('the owner is shown the time in their own zone, in plain words', () => {
  const from = new Date('2026-08-16T00:00:00.000Z')
  assert.equal(
    describePostingTime(new Date('2026-08-16T23:00:00.000Z'), brisbane, from),
    'Monday 9:00am',
  )
  assert.equal(
    describePostingTime(new Date('2026-08-18T02:30:00.000Z'), brisbane, from),
    'Tuesday 12:30pm',
  )
  // Past a week, "Tuesday" on its own has stopped being an answer.
  assert.equal(
    describePostingTime(new Date('2026-10-06T23:00:00.000Z'), brisbane, from),
    'Wednesday 7 Oct 9:00am',
  )
})

test('a time that has gone by is recognised as past', () => {
  const now = new Date('2026-08-16T00:00:00.000Z')
  assert.equal(isInThePast(new Date('2026-08-15T23:59:00.000Z'), now), true)
  assert.equal(isInThePast(new Date('2026-08-16T00:01:00.000Z'), now), false)
})
