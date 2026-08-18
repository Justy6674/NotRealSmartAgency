/**
 * When does a recurring weekly time next come round?
 *
 * ── What was removed from this file, and why ───────────────────────────
 * `assignToSlot()` and `unassignFromSlot()` used to live here. They wrote
 * `queue_slot_id` onto a `scheduled_posts` row and worked out which slot
 * occurrence was free. They had **zero callers**. Nothing ever wrote a slot
 * assignment, so `queue_slot_id` was always null, every per-slot count on the
 * posting-schedule page was permanently 0, and the publish cron never looked at
 * a slot at all — while the page told the owner drafts would "publish at the
 * next open slot". That sentence was not true, and 130 lines of careful
 * collision-avoidance was the reason it looked as though it was.
 *
 * Queueing is now the publisher's own queue (`src/lib/zernio/queue.ts`), which
 * takes a lock when it assigns a time. Reading a free time here and copying it
 * into `scheduledFor` is explicitly warned against upstream for exactly that
 * reason: two posts land on the same minute.
 *
 * `queue_slot_id` is no longer always null either. `fill-calendar.ts` reads the
 * owner's CONFIGURED `posting_schedule_slots` and carries the slot id through
 * `createDraftPost({ queueSlotId })`, so a post the Director writes into a slot
 * keeps that slot on its row and the per-slot counts are real. That is the one
 * writer, and it goes through the canonical draft pipeline — which is why the
 * two functions below are not coming back as a second one.
 *
 * ── What is left, and who uses it ──────────────────────────────────────
 * The date arithmetic, because the composer genuinely needs it: given the
 * week's times, when is the next one? That answer is shown as a hint beside
 * "next free time" — a sentence, not a booking. It never writes anything.
 */

import type { PostingScheduleSlot } from '@/types/database'

/**
 * The next concrete instant a weekly slot falls on, after `from`.
 *
 * The slot's time is wall-clock in the slot's own zone, converted to UTC
 * through `Intl` rather than a hard-coded offset table. That table used to
 * approximate the southern states at standard time, so every Sydney,
 * Melbourne, Hobart or Adelaide slot read an hour wrong for the five months
 * of daylight saving — an "8am" post the owner was shown as 8am. Pinned by
 * the DST case in assign-to-slot.test.ts.
 *
 * It still never BOOKS anything: this answers "when does this come round
 * next?" for a hint beside "next free time". The publisher's queue
 * (`src/lib/zernio/queue.ts`) takes a lock when it assigns a real time.
 */
export function nextOccurrence(
  slot: Pick<PostingScheduleSlot, 'day_of_week' | 'time' | 'timezone'>,
  from: Date,
): Date {
  const [hStr, mStr, sStr] = slot.time.split(':')
  const hour = parseInt(hStr ?? '0', 10)
  const minute = parseInt(mStr ?? '0', 10)
  const second = parseInt(sStr ?? '0', 10)

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const probe = new Date(from.getTime() + dayOffset * 86_400_000)
    const localDate = zonedParts(probe, slot.timezone)
    const localDow = new Date(
      Date.UTC(localDate.year, localDate.month - 1, localDate.day),
    ).getUTCDay()

    if (localDow !== slot.day_of_week) continue
    const candidate = zonedDateTimeToUtc(
      localDate.year,
      localDate.month,
      localDate.day,
      hour,
      minute,
      second,
      slot.timezone,
    )
    if (candidate.getTime() <= from.getTime()) continue

    return candidate
  }

  // A weekly slot always recurs within seven days, so this is unreachable in
  // practice. Falling forward a week beats returning a time in the past.
  return new Date(from.getTime() + 7 * 86_400_000)
}

/**
 * The soonest of the week's times, or null.
 *
 * Null when no times are set, and the caller must show nothing rather than
 * invent one: a composer that quietly picks a time the owner never chose is
 * worse than one that says there is no schedule yet.
 */
export function earliestNextSlot(
  slots: Array<Pick<PostingScheduleSlot, 'day_of_week' | 'time' | 'timezone'>>,
  from: Date,
): Date | null {
  if (slots.length === 0) return null
  let best: Date | null = null
  for (const slot of slots) {
    const when = nextOccurrence(slot, from)
    if (!best || when.getTime() < best.getTime()) best = when
  }
  return best
}

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function offsetAt(date: Date, timeZone: string): number {
  const local = zonedParts(date, timeZone)
  const representedAsUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
  )
  return representedAsUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * A wall-clock time in a zone, as an instant.
 *
 * Exported because the composer's "Choose a time" picker needs exactly this
 * conversion and there must not be a second implementation of it: 9:00 typed
 * into the picker means 9:00 in the BUSINESS's zone, not in whatever zone the
 * laptop happens to be on. Brisbane is a fixed UTC+10, so for the owner's own
 * brands this is arithmetic he will never notice; a brand in a daylight-saving
 * zone is right for the same reason `nextOccurrence` is, because both go
 * through `Intl` rather than a hard-coded offset.
 */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const wallTime = Date.UTC(year, month - 1, day, hour, minute, second)
  let candidate = new Date(wallTime)
  for (let attempt = 0; attempt < 2; attempt++) {
    candidate = new Date(wallTime - offsetAt(candidate, timeZone))
  }
  return candidate
}
