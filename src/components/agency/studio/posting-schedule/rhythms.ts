/**
 * The rhythms — the whole point of the posting-times screen.
 *
 * ── What this replaces ─────────────────────────────────────────────────
 * The screen used to open on an empty seven-column grid and wait. Scent Sell
 * has no posting times at all, so what the owner actually saw was seven boxes
 * saying "No times" and a button per box. Setting a week meant twenty-eight
 * separate dialogs. Two people use this screen — neither is a developer, and
 * one of them works entirely from buttons — so "here is a grid, fill it in" is
 * not a slow start, it is a wall.
 *
 * A rhythm is one click that fills the whole week. The grid stays, underneath,
 * for the tweaking afterwards.
 *
 * ── Why the shapes live here and not in a component ────────────────────
 * `audienceRhythm` decides whether this business's own results are solid enough
 * to put in front of somebody as a measurement. That is a judgement with a
 * wrong answer — offering a week built on three posts and calling it evidence —
 * so it is a pure function with tests beside it rather than a threshold buried
 * in JSX or in a network call.
 *
 * Nothing here writes. Nothing here is seeded on load: every time on this
 * screen exists because a person clicked to put it there.
 */

/** 0 = Sunday, matching `posting_schedule_slots.day_of_week` and the queue. */
export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]
const MONDAY_TO_FRIDAY = [1, 2, 3, 4, 5]

/** One time on the week. `platforms` empty means every connected account. */
export interface WeekTime {
  day_of_week: number
  time: string
  platforms?: string[]
}

export interface Rhythm {
  id: string
  /** What it is called on the card. Plain English, no jargon. */
  name: string
  /** One sentence saying what it does, in the owner's own words. */
  blurb: string
  /** The times it sets, in the order they run. "HH:MM". */
  times: string[]
  /** The days it runs on. */
  days: number[]
  /** Said out loud on the card when the days are not every day. */
  daysLabel: string
}

/**
 * The four shapes, roughly loudest to quietest.
 *
 * The owner named 9:00am / 12:00pm / 5:00pm / 8:00pm himself as a week he would
 * accept, so that is the first card rather than an invention. The rest step
 * down from it so there is a real choice rather than one suggestion wearing
 * four hats.
 */
export const RHYTHMS: readonly Rhythm[] = [
  {
    id: 'four-a-day',
    name: 'Four times a day',
    blurb: 'Morning, midday, late afternoon and evening — every day of the week.',
    times: ['09:00', '12:00', '17:00', '20:00'],
    days: EVERY_DAY,
    daysLabel: 'Every day',
  },
  {
    id: 'twice-a-day',
    name: 'Twice a day',
    blurb: 'One in the morning and one at knock-off time, every day of the week.',
    times: ['09:00', '17:00'],
    days: EVERY_DAY,
    daysLabel: 'Every day',
  },
  {
    id: 'once-a-day',
    name: 'Once a day',
    blurb: 'A single post each morning. The easiest one to keep up with.',
    times: ['09:00'],
    days: EVERY_DAY,
    daysLabel: 'Every day',
  },
  {
    id: 'weekdays-only',
    name: 'Weekdays only',
    blurb: 'Morning and late afternoon, Monday to Friday. Nothing at the weekend.',
    times: ['09:00', '17:00'],
    days: MONDAY_TO_FRIDAY,
    daysLabel: 'Monday to Friday',
  },
]

/** Every time a rhythm sets, ready to save. */
export function buildWeek(rhythm: Pick<Rhythm, 'times' | 'days'>): WeekTime[] {
  const week: WeekTime[] = []
  for (const day of rhythm.days) {
    for (const time of rhythm.times) {
      week.push({ day_of_week: day, time })
    }
  }
  return week.sort((a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time))
}

export function weeklyCount(rhythm: Pick<Rhythm, 'times' | 'days'>): number {
  return rhythm.times.length * rhythm.days.length
}

/** "9:00am", never "09:00" — nobody should read a 24-hour clock to check a week. */
export function friendlyTime(hhmm: string): string {
  const [hourText, minuteText = '00'] = hhmm.split(':')
  const hour = Number(hourText)
  if (!Number.isFinite(hour)) return hhmm
  const suffix = hour < 12 ? 'am' : 'pm'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return minuteText === '00' ? `${twelve}${suffix}` : `${twelve}:${minuteText}${suffix}`
}

/**
 * "Australia/Brisbane" → "Brisbane time".
 *
 * Said on the screen because 9:00am is meaningless without it, and because
 * Brisbane keeps the same clock all year — 9:00am is 9:00am in January and in
 * July. That is the correct behaviour for this owner, not an oversight, so the
 * screen states the zone plainly rather than hedging about daylight saving.
 *
 * Read from the stored value rather than hard-coded, so a business somewhere
 * else still reads correctly.
 */
export function timezoneLabel(timezone: string): string {
  const place = (timezone.split('/').pop() ?? timezone).replace(/_/g, ' ')
  return place ? `${place} time` : timezone
}

/** "Facebook, Instagram and TikTok" — an Australian-English list. */
export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0]!
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/* ── What this business's own results say ──────────────────────────────── */

export interface BestTime {
  day_of_week: number
  time: string
  /** How many published posts sit behind this one time. */
  posts: number
}

export interface AudienceRhythm {
  times: WeekTime[]
  /** Everything the answer was worked out from — the honesty of the card. */
  postsCounted: number
  daysCovered: number
}

/**
 * Fewer posts than this behind one time and it is an anecdote, not a pattern.
 * Zernio groups every published post into a day-and-hour bucket, so a bucket of
 * one is a single post that happened to do well once.
 */
export const MIN_POSTS_PER_TIME = 3

/** Below this much history overall there is nothing worth calling a result. */
export const MIN_POSTS_COUNTED = 20

/** Two good days is not a week. Three is the least that can be offered as one. */
export const MIN_DAYS_COVERED = 3

/**
 * A week built from what this business's audience actually did — or nothing.
 *
 * Returning `null` is the important half. The screen must never show a
 * recommendation it cannot stand behind, so a business with a handful of posts
 * simply does not get this card; it gets the four rhythms, which are honestly
 * presented as sensible defaults rather than as measurements.
 *
 * The shape is one time per day, strongest first, because that is a week
 * somebody can look at and judge. Stacking every good hour onto Tuesday would
 * be a truer ranking and a useless schedule.
 *
 * Measured against Scent Sell on 2026-08-19: 206 published posts across 71
 * buckets, 39 of them clearing the bar, giving a full seven-day week.
 */
export function audienceRhythm(
  bestTimes: readonly BestTime[],
  postsCounted: number,
): AudienceRhythm | null {
  if (postsCounted < MIN_POSTS_COUNTED) return null

  const solid = bestTimes.filter((slot) => slot.posts >= MIN_POSTS_PER_TIME)

  // `bestTimes` arrives strongest first, so the first time seen for a day is
  // that day's best. Sorting again here would throw that ordering away.
  const perDay = new Map<number, BestTime>()
  for (const slot of solid) {
    if (slot.day_of_week < 0 || slot.day_of_week > 6) continue
    if (!perDay.has(slot.day_of_week)) perDay.set(slot.day_of_week, slot)
  }

  if (perDay.size < MIN_DAYS_COVERED) return null

  const times = [...perDay.values()]
    .map((slot) => ({ day_of_week: slot.day_of_week, time: slot.time }))
    .sort((a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time))

  return { times, postsCounted, daysCovered: perDay.size }
}

/** Does the week already saved match this set of times exactly? */
export function weekMatches(saved: readonly WeekTime[], candidate: readonly WeekTime[]): boolean {
  if (saved.length !== candidate.length) return false
  const key = (slot: WeekTime) => `${slot.day_of_week}:${slot.time}`
  const savedKeys = new Set(saved.map(key))
  return candidate.every((slot) => savedKeys.has(key(slot)))
}

/**
 * Shift a time by some minutes, wrapping inside the same day.
 *
 * Wrapping rather than spilling onto the next day: nudging 11:45pm forward
 * moving the post to Monday is not what "a bit later" means to anybody, and it
 * would silently rewrite which day the owner was looking at.
 */
export function nudgeTime(hhmm: string, minutes: number): string {
  const [hourText = '0', minuteText = '0'] = hhmm.split(':')
  const total = Number(hourText) * 60 + Number(minuteText)
  if (!Number.isFinite(total)) return hhmm
  const shifted = ((total + minutes) % 1440 + 1440) % 1440
  const hour = Math.floor(shifted / 60)
  const minute = shifted % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}
