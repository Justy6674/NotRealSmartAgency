import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MIN_DAYS_COVERED,
  MIN_POSTS_COUNTED,
  MIN_POSTS_PER_TIME,
  RHYTHMS,
  audienceRhythm,
  buildWeek,
  friendlyTime,
  joinNames,
  nudgeTime,
  timezoneLabel,
  weekMatches,
  weeklyCount,
} from './rhythms.ts'

test('the owner’s own four times are offered exactly as he gave them', () => {
  const four = RHYTHMS.find((rhythm) => rhythm.id === 'four-a-day')
  assert.ok(four)
  assert.deepEqual(four.times, ['09:00', '12:00', '17:00', '20:00'])
  assert.equal(four.days.length, 7)
  assert.equal(weeklyCount(four), 28)
})

test('every rhythm fills a whole week in one click', () => {
  for (const rhythm of RHYTHMS) {
    const week = buildWeek(rhythm)
    assert.equal(week.length, weeklyCount(rhythm), rhythm.id)
    // One click is the entire required interaction, so a rhythm that left a day
    // it claims to cover unset would send the owner back to the grid.
    for (const day of rhythm.days) {
      const onThatDay = week.filter((slot) => slot.day_of_week === day)
      assert.equal(onThatDay.length, rhythm.times.length, `${rhythm.id} day ${day}`)
    }
  }
})

test('weekdays only leaves the weekend alone', () => {
  const weekdays = RHYTHMS.find((rhythm) => rhythm.id === 'weekdays-only')
  assert.ok(weekdays)
  const week = buildWeek(weekdays)
  assert.equal(week.length, 10)
  assert.equal(week.some((slot) => slot.day_of_week === 0 || slot.day_of_week === 6), false)
})

test('a rhythm never carries a network — a time covers every connected account', () => {
  for (const rhythm of RHYTHMS) {
    for (const slot of buildWeek(rhythm)) {
      assert.equal(slot.platforms, undefined, rhythm.id)
    }
  }
})

test('times read as a person says them, not as a 24-hour clock', () => {
  assert.equal(friendlyTime('09:00'), '9am')
  assert.equal(friendlyTime('12:00'), '12pm')
  assert.equal(friendlyTime('17:30'), '5:30pm')
  assert.equal(friendlyTime('00:00'), '12am')
  assert.equal(friendlyTime('20:00'), '8pm')
})

test('the timezone is named plainly and comes from the stored value', () => {
  assert.equal(timezoneLabel('Australia/Brisbane'), 'Brisbane time')
  // Read from the row rather than assumed, so a business elsewhere still reads
  // correctly. Brisbane stays the default and nothing upgrades it.
  assert.equal(timezoneLabel('Australia/Perth'), 'Perth time')
  assert.equal(timezoneLabel('America/New_York'), 'New York time')
})

test('account names are listed in Australian English', () => {
  assert.equal(joinNames([]), '')
  assert.equal(joinNames(['Facebook']), 'Facebook')
  assert.equal(joinNames(['Facebook', 'Instagram']), 'Facebook and Instagram')
  assert.equal(
    joinNames(['Facebook', 'Instagram', 'TikTok', 'YouTube']),
    'Facebook, Instagram, TikTok and YouTube',
  )
})

/* ── The honesty gate ──────────────────────────────────────────────────── */

test('too little history means no recommendation at all, not a guess', () => {
  // Well-shaped, spread over five days, and still refused: nineteen posts is
  // not a result. Showing it would present a guess as a measurement.
  const thin = [
    { day_of_week: 1, time: '09:00', posts: 4 },
    { day_of_week: 2, time: '10:00', posts: 4 },
    { day_of_week: 3, time: '11:00', posts: 4 },
    { day_of_week: 4, time: '12:00', posts: 4 },
    { day_of_week: 5, time: '13:00', posts: 3 },
  ]
  assert.equal(audienceRhythm(thin, MIN_POSTS_COUNTED - 1), null)
  assert.notEqual(audienceRhythm(thin, MIN_POSTS_COUNTED), null)
})

test('a time resting on one or two posts is never offered', () => {
  const anecdotes = [
    { day_of_week: 1, time: '09:00', posts: MIN_POSTS_PER_TIME - 1 },
    { day_of_week: 2, time: '10:00', posts: 1 },
    { day_of_week: 3, time: '11:00', posts: 2 },
    { day_of_week: 4, time: '12:00', posts: 1 },
  ]
  assert.equal(audienceRhythm(anecdotes, 400), null)
})

test('fewer than three days is not a week and is refused', () => {
  const twoDays = [
    { day_of_week: 1, time: '09:00', posts: 12 },
    { day_of_week: 1, time: '19:00', posts: 9 },
    { day_of_week: 4, time: '13:00', posts: 8 },
  ]
  assert.equal(audienceRhythm(twoDays, 400), null)

  const threeDays = [...twoDays, { day_of_week: 6, time: '16:00', posts: 5 }]
  const built = audienceRhythm(threeDays, 400)
  assert.ok(built)
  assert.equal(built.daysCovered, MIN_DAYS_COVERED)
})

test('the recommendation is one time per day, keeping each day’s strongest', () => {
  // Strongest first is how the route hands them over; the first time seen for a
  // day is that day's best. Tuesday appears twice and only the leader survives.
  const ranked = [
    { day_of_week: 2, time: '19:00', posts: 3 },
    { day_of_week: 4, time: '13:00', posts: 7 },
    { day_of_week: 2, time: '04:00', posts: 3 },
    { day_of_week: 6, time: '16:00', posts: 3 },
    { day_of_week: 1, time: '10:00', posts: 5 },
  ]
  const built = audienceRhythm(ranked, 206)
  assert.ok(built)
  assert.deepEqual(built.times, [
    { day_of_week: 1, time: '10:00' },
    { day_of_week: 2, time: '19:00' },
    { day_of_week: 4, time: '13:00' },
    { day_of_week: 6, time: '16:00' },
  ])
  assert.equal(built.postsCounted, 206)
})

test('Scent Sell’s real answer becomes a full seven-day week', () => {
  // Converted to Brisbane from the live Zernio reading on 2026-08-19:
  // 206 published posts, 71 buckets, 39 clearing the bar.
  const measured = [
    { day_of_week: 2, time: '19:00', posts: 3 },
    { day_of_week: 6, time: '16:00', posts: 3 },
    { day_of_week: 0, time: '20:00', posts: 3 },
    { day_of_week: 5, time: '12:00', posts: 3 },
    { day_of_week: 3, time: '19:00', posts: 3 },
    { day_of_week: 4, time: '13:00', posts: 7 },
    { day_of_week: 1, time: '10:00', posts: 5 },
    { day_of_week: 1, time: '01:00', posts: 1 },
  ]
  const built = audienceRhythm(measured, 206)
  assert.ok(built)
  assert.equal(built.daysCovered, 7)
  assert.equal(built.times.length, 7)
  assert.equal(built.times.some((slot) => slot.time === '01:00'), false)
})

/* ── Tweaking afterwards ───────────────────────────────────────────────── */

test('a saved week is recognised as the rhythm that set it', () => {
  const twice = RHYTHMS.find((rhythm) => rhythm.id === 'twice-a-day')!
  const once = RHYTHMS.find((rhythm) => rhythm.id === 'once-a-day')!
  assert.equal(weekMatches(buildWeek(twice), buildWeek(twice)), true)
  assert.equal(weekMatches(buildWeek(twice), buildWeek(once)), false)
  // One nudged time and it is no longer that rhythm — saying otherwise would
  // label the owner's own edit as somebody else's preset.
  const edited = buildWeek(twice).slice(1)
  assert.equal(weekMatches(edited, buildWeek(twice)), false)
})

test('nudging wraps inside the day rather than moving the post to another one', () => {
  assert.equal(nudgeTime('09:00', 15), '09:15')
  assert.equal(nudgeTime('09:00', -15), '08:45')
  assert.equal(nudgeTime('23:45', 15), '00:00')
  assert.equal(nudgeTime('00:00', -15), '23:45')
  assert.equal(nudgeTime('17:50', 15), '18:05')
})
