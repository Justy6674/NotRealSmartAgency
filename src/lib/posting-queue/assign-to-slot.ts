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
 * ── What is left, and who uses it ──────────────────────────────────────
 * The date arithmetic, because the composer genuinely needs it: given the
 * week's times, when is the next one? That answer is shown as a hint beside
 * "next free time" — a sentence, not a booking. It never writes anything.
 */

import type { PostingScheduleSlot } from '@/types/database'

/**
 * The next concrete instant a weekly slot falls on, after `from`.
 *
 * The slot's time is wall-clock in the slot's own zone. Brisbane, Darwin and
 * Perth have no daylight saving so those are exact; the southern states are
 * approximated at standard time, which is fine for a hint and is the reason
 * this is a hint. The queue is the source of truth for an actual booking.
 */
export function nextOccurrence(
  slot: Pick<PostingScheduleSlot, 'day_of_week' | 'time' | 'timezone'>,
  from: Date,
): Date {
  const [hStr, mStr, sStr] = slot.time.split(':')
  const hour = parseInt(hStr ?? '0', 10)
  const minute = parseInt(mStr ?? '0', 10)
  const second = parseInt(sStr ?? '0', 10)

  const offsetMinutes = timezoneOffsetMinutes(slot.timezone)

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const candidate = new Date(from.getTime())
    candidate.setUTCDate(from.getUTCDate() + dayOffset)
    candidate.setUTCHours(hour, minute, second, 0)
    // Local wall clock → UTC.
    candidate.setTime(candidate.getTime() - offsetMinutes * 60_000)

    const local = new Date(candidate.getTime() + offsetMinutes * 60_000)
    if (local.getUTCDay() !== slot.day_of_week) continue
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

/** IANA zone → offset in minutes. Australian zones only; anything else is UTC+10. */
function timezoneOffsetMinutes(tz: string): number {
  switch (tz) {
    case 'Australia/Brisbane':
      return 600
    case 'Australia/Darwin':
      return 570 // UTC+9:30
    case 'Australia/Perth':
      return 480
    // Daylight saving is approximated at standard time. See the docblock: this
    // is a hint, and the queue books the real time.
    case 'Australia/Sydney':
    case 'Australia/Melbourne':
    case 'Australia/Hobart':
      return 600
    case 'Australia/Adelaide':
      return 570
    case 'UTC':
      return 0
    default:
      return 600
  }
}
