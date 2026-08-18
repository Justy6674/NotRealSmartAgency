/**
 * "When is the next free time?" — the answer behind the composer's button.
 *
 * ── The fault this fixes ───────────────────────────────────────────────
 * The composer offered four ways to leave a post, and the second one — "Add to
 * next free time" — was dead. It read the week's times, took the earliest
 * occurrence and handed that back, which was wrong in two ways at once: it did
 * not look at whether a post was ALREADY sitting on that time, and it never
 * said out loud which time it had picked. Pressing it either did nothing (no
 * times set) or silently scheduled onto a time that was already spoken for.
 *
 * ── The two rules ──────────────────────────────────────────────────────
 * 1. A time in the week is a TIME, not a network. One 9:00am Tuesday serves
 *    every account ticked on the post — the owner sets their week once, not
 *    once per network. The table cannot say that in one row (its unique key
 *    includes the platform), so one time is stored as one row per connected
 *    network. Several rows therefore land on the same instant, and that is not
 *    a clash: they are one time. Which is exactly why "taken" below is keyed by
 *    the INSTANT and not by counting rows.
 * 2. A time that already has a post on it is not free. Taken is judged two
 *    ways, because there are two ways a post can hold a time: it carries the
 *    slot's id (`scheduled_posts.queue_slot_id`), or it is simply already
 *    scheduled for that exact minute. The second catches a post put there by
 *    hand through "Choose a time", which carries no slot id at all.
 *
 * One post going to three ticked accounts is three `scheduled_posts` rows on
 * the same instant carrying the same slot id. That is one outing, not three,
 * and it occupies the time once — which is why "taken" is keyed by the instant
 * rather than counted.
 *
 * ── Timezones ──────────────────────────────────────────────────────────
 * Every instant here comes from `nextOccurrence`, which converts a wall-clock
 * time in the slot's own zone through `Intl`. There is deliberately no second
 * timezone implementation in this file. Brisbane is a fixed UTC+10 with no
 * daylight saving, and that is the correct behaviour for the owner's own
 * brands: 9:00am means 9:00am all year. A brand in a DST zone still comes out
 * right because the conversion is `Intl`'s, not a hard-coded offset.
 */

import { nextOccurrence } from './assign-to-slot'

const DAY_MS = 86_400_000

/** How far ahead a free time is looked for. Four weeks is a fortnight twice. */
export const DEFAULT_HORIZON_DAYS = 28

/**
 * One of the owner's weekly posting times.
 *
 * `id` is null when the time came from the publisher's own queue rather than
 * from a row in `posting_schedule_slots` — a real time with no id we may store,
 * because `queue_slot_id` is a foreign key to that table.
 */
export interface WeeklyPostingTime {
  id: string | null
  day_of_week: number
  time: string
  timezone: string | null
  platform?: string | null
}

/** Just enough of a `scheduled_posts` row to tell whether it holds a time. */
export interface BookedPost {
  queue_slot_id?: string | null
  scheduled_at?: string | null
  status?: string | null
}

export interface BookedTimes {
  /** Instants that already have a post on them, to the minute. */
  instants: Set<string>
  /** `slotId@instant` pairs, for a post that names the time it was given. */
  slotOccurrences: Set<string>
}

export interface FreeTime {
  /** The slot's id, or null when the time came from the publisher's queue. */
  slotId: string | null
  when: Date
  timezone: string
  /**
   * The slot id to put on each network's row, keyed by network.
   *
   * One time is stored as one row per connected network, so the Instagram row
   * of a post should carry the Instagram time's id and the Facebook row the
   * Facebook one. Empty when the times came from the publisher's queue, which
   * has no ids of its own that we may store.
   */
  slotIdByPlatform: Record<string, string>
}

/** An instant, to the minute. Seconds are noise when comparing posting times. */
export function minuteKey(when: Date | string): string {
  const date = typeof when === 'string' ? new Date(when) : when
  if (Number.isNaN(date.getTime())) return ''
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000).toISOString()
}

/**
 * Which times are already spoken for.
 *
 * A cancelled post has given its time back, so it is not counted. Everything
 * else is — including a draft that has been put on a time, because the owner
 * meant that time to be its.
 */
export function bookedTimes(posts: BookedPost[]): BookedTimes {
  const instants = new Set<string>()
  const slotOccurrences = new Set<string>()
  for (const post of posts) {
    if (post.status === 'cancelled') continue
    const key = post.scheduled_at ? minuteKey(post.scheduled_at) : ''
    if (!key) continue
    instants.add(key)
    if (post.queue_slot_id) slotOccurrences.add(`${post.queue_slot_id}@${key}`)
  }
  return { instants, slotOccurrences }
}

export function isTaken(slotId: string | null, when: Date, booked: BookedTimes): boolean {
  const key = minuteKey(when)
  if (!key) return false
  if (booked.instants.has(key)) return true
  return slotId ? booked.slotOccurrences.has(`${slotId}@${key}`) : false
}

/**
 * The genuinely next unused time, or null.
 *
 * Null means one of two different things and the caller has to tell them apart:
 * no times set at all (`slots` empty), or every time inside the horizon already
 * has a post on it. Saying "there is no next time" for the first case and
 * offering to go and set some is the whole point of the button not failing
 * quietly.
 */
export function nextFreeTime(
  slots: WeeklyPostingTime[],
  booked: BookedTimes,
  from: Date,
  options: { horizonDays?: number; fallbackTimezone?: string } = {},
): FreeTime | null {
  const horizonDays = options.horizonDays ?? DEFAULT_HORIZON_DAYS
  const fallbackTimezone = options.fallbackTimezone ?? 'Australia/Brisbane'
  const horizon = from.getTime() + horizonDays * DAY_MS

  const earliestPerSlot: Array<{ slot: WeeklyPostingTime; when: Date; timezone: string }> = []

  for (const slot of slots) {
    const timezone = slot.timezone ?? fallbackTimezone
    let cursor = from
    // Each weekly time is walked forward until one of its occurrences is free.
    // The cap is the horizon, so a fully booked week ends the walk rather than
    // spinning.
    for (let guard = 0; guard < horizonDays + 1; guard++) {
      const when = nextOccurrence(
        { day_of_week: slot.day_of_week, time: slot.time, timezone },
        cursor,
      )
      if (when.getTime() > horizon) break
      if (!isTaken(slot.id, when, booked)) {
        earliestPerSlot.push({ slot, when, timezone })
        break
      }
      cursor = new Date(when.getTime() + 60_000)
    }
  }

  if (earliestPerSlot.length === 0) return null

  const winner = earliestPerSlot.reduce((soonest, entry) =>
    entry.when.getTime() < soonest.when.getTime() ? entry : soonest,
  )

  // Every row sitting on the winning instant is the SAME time, split across the
  // networks it posts to. They travel together so each network's row can carry
  // its own id.
  const slotIdByPlatform: Record<string, string> = {}
  for (const entry of earliestPerSlot) {
    if (entry.when.getTime() !== winner.when.getTime()) continue
    const platform = entry.slot.platform
    if (platform && entry.slot.id && !slotIdByPlatform[platform]) {
      slotIdByPlatform[platform] = entry.slot.id
    }
  }

  return {
    slotId: winner.slot.id,
    when: winner.when,
    timezone: winner.timezone,
    slotIdByPlatform,
  }
}

/**
 * The first of a list of already-resolved times that is still free.
 *
 * Used when the times come from the publisher's own queue as instants rather
 * than as a weekly pattern. Nothing is invented here — the list is read in the
 * order it was given.
 */
export function firstFreeInstant(instants: string[], booked: BookedTimes, from: Date): string | null {
  for (const iso of instants) {
    const when = new Date(iso)
    if (Number.isNaN(when.getTime())) continue
    if (when.getTime() <= from.getTime()) continue
    if (isTaken(null, when, booked)) continue
    return when.toISOString()
  }
  return null
}

/**
 * "Tuesday 9:00am" — the sentence the owner reads on the button.
 *
 * Written in the time's own zone, never the browser's, because the owner set
 * 9:00am in Brisbane and 9:00am is what they must be shown. Past a week the
 * date is added, since "Tuesday" on its own stops being an answer.
 */
export function describePostingTime(when: Date, timezone: string, from: Date = new Date()): string {
  if (Number.isNaN(when.getTime())) return 'the next free time'
  const withinAWeek = when.getTime() - from.getTime() < 7 * DAY_MS

  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(when)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''

  const clock = `${get('hour')}:${get('minute')}${get('dayPeriod').replace(/\s|\./g, '').toLowerCase()}`
  return withinAWeek
    ? `${get('weekday')} ${clock}`
    : `${get('weekday')} ${get('day')} ${get('month')} ${clock}`
}

/** True when a time the owner typed has already gone by. */
export function isInThePast(when: Date, from: Date = new Date()): boolean {
  return when.getTime() <= from.getTime()
}
