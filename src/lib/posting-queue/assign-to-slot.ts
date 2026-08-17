/**
 * Posting queue — slot assignment algorithm.
 *
 * Mixpost-style: users define a recurring weekly schedule of slots
 * (e.g. Mon 9am, Wed 5pm). Drafts dropped into the queue are assigned
 * to the next available slot for their platform; the cron publisher
 * uses `queue_slot_id` to know which slot to fire on.
 *
 * "Available" = the slot does not already have another scheduled_post
 * pointing at it for the same upcoming occurrence. We compute the next
 * concrete `scheduled_at` for each slot in order, then pick the first
 * one that has no collision.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostPlatform, PostingScheduleSlot } from '@/types/database'

export interface AssignToSlotInput {
  scheduledPostId: string
  brandId: string
  platform: PostPlatform
  /** ISO timestamp — defaults to now. Useful for tests. */
  fromIso?: string
  /** How many days forward to scan before giving up. Defaults to 14. */
  horizonDays?: number
}

export interface AssignToSlotResult {
  slot_id: string
  scheduled_at: string
}

/**
 * Compute the next concrete UTC ISO timestamp for a recurring slot,
 * given a "from" anchor. Time-of-day is interpreted in the slot's
 * own timezone (default Australia/Brisbane), then converted to UTC.
 *
 * For simplicity we treat the slot time as wall-clock in the slot
 * timezone and rely on the JS Date arithmetic — Brisbane has no DST
 * so this is exact for the default tz, and "good enough for queue
 * planning" for other Australian tzs (the cron job is the source of
 * truth at publish time anyway).
 */
export function nextOccurrence(
  slot: Pick<PostingScheduleSlot, 'day_of_week' | 'time' | 'timezone'>,
  from: Date,
): Date {
  // Parse "HH:MM" or "HH:MM:SS"
  const [hStr, mStr, sStr] = slot.time.split(':')
  const hour = parseInt(hStr ?? '0', 10)
  const minute = parseInt(mStr ?? '0', 10)
  const second = parseInt(sStr ?? '0', 10)

  // Step day-by-day from `from`. We compare against the slot's
  // local-day-of-week (0..6 with 0 = Sunday) and update the time-of-day.
  // We use UTC date arithmetic and assume the timezone offset is
  // applied at the very end. For Brisbane (UTC+10, no DST) the wall
  // clock is just UTC + 10h.
  const offsetMinutes = timezoneOffsetMinutes(slot.timezone)

  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const candidate = new Date(from.getTime())
    candidate.setUTCDate(from.getUTCDate() + dayOffset)
    // Local wall-clock target on this day
    candidate.setUTCHours(hour, minute, second, 0)
    // Convert local wall-clock → UTC by subtracting the tz offset
    candidate.setTime(candidate.getTime() - offsetMinutes * 60_000)

    // Local day of week for that candidate (in slot tz)
    const local = new Date(candidate.getTime() + offsetMinutes * 60_000)
    const localDow = local.getUTCDay()

    if (localDow !== slot.day_of_week) continue
    if (candidate.getTime() <= from.getTime()) continue

    return candidate
  }

  // Shouldn't happen: a slot's day_of_week always recurs within 7 days.
  // Fall back to the +7d candidate.
  const fallback = new Date(from.getTime() + 7 * 86_400_000)
  return fallback
}

/**
 * The next time on the plan, in the owner's language "next free slot".
 * No slots configured → nothing to pick; the composer must not invent a time.
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

/**
 * Returns the IANA timezone offset in minutes (e.g. Brisbane = +600).
 * Hard-codes the Australian tzs we ship with; falls back to 0.
 */
function timezoneOffsetMinutes(tz: string): number {
  // No DST in QLD/NT/WA so these are stable.
  switch (tz) {
    case 'Australia/Brisbane':
      return 600
    case 'Australia/Darwin':
      return 570 // UTC+9:30
    case 'Australia/Perth':
      return 480
    // The southern states have DST — we approximate with the standard-time
    // offset. Cron is the source of truth at publish time.
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

/**
 * Find the next available slot for a draft and write `queue_slot_id`
 * + `scheduled_at` back to its row.
 *
 * Returns null if there are no slots configured for that platform on
 * the brand. Caller should fall back to manual scheduling in that case.
 */
export async function assignToSlot(
  supabase: SupabaseClient,
  input: AssignToSlotInput,
): Promise<AssignToSlotResult | null> {
  const from = input.fromIso ? new Date(input.fromIso) : new Date()
  const horizonMs = (input.horizonDays ?? 14) * 86_400_000
  const horizonEnd = new Date(from.getTime() + horizonMs)

  // 1. Load all slots for this brand+platform
  const { data: slots, error: slotErr } = await supabase
    .from('posting_schedule_slots')
    .select('*')
    .eq('brand_id', input.brandId)
    .eq('platform', input.platform)

  if (slotErr) throw new Error(`assignToSlot: failed to load slots: ${slotErr.message}`)
  if (!slots || slots.length === 0) return null

  // 2. Compute the next concrete occurrence for each slot, then sort
  //    ascending so we try the earliest first.
  const candidates = (slots as PostingScheduleSlot[])
    .map((slot) => ({ slot, occurrence: nextOccurrence(slot, from) }))
    .filter((c) => c.occurrence.getTime() <= horizonEnd.getTime())
    .sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())

  if (candidates.length === 0) return null

  // 3. Load existing queued scheduled_posts for this brand+platform
  //    in our window so we can detect collisions.
  const { data: existing, error: existingErr } = await supabase
    .from('scheduled_posts')
    .select('id, queue_slot_id, scheduled_at')
    .eq('brand_id', input.brandId)
    .eq('platform', input.platform)
    .not('queue_slot_id', 'is', null)
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', horizonEnd.toISOString())
    .neq('id', input.scheduledPostId)

  if (existingErr) throw new Error(`assignToSlot: failed to load existing queue: ${existingErr.message}`)

  const taken = new Set<string>()
  for (const row of existing ?? []) {
    // A slot occurrence is "taken" if another post is queued at the
    // same slot_id AND at the same scheduled_at (to the second).
    if (row.queue_slot_id && row.scheduled_at) {
      taken.add(`${row.queue_slot_id}|${new Date(row.scheduled_at).toISOString()}`)
    }
  }

  // 4. Pick the first candidate whose (slot_id, occurrence) is free.
  //    If a slot is taken, advance to its NEXT occurrence and re-sort.
  for (let attempt = 0; attempt < candidates.length * 4; attempt++) {
    candidates.sort((a, b) => a.occurrence.getTime() - b.occurrence.getTime())
    const next = candidates[0]
    if (!next) break

    const key = `${next.slot.id}|${next.occurrence.toISOString()}`
    if (!taken.has(key)) {
      // Free — claim it.
      const scheduled_at = next.occurrence.toISOString()
      const { error: updErr } = await supabase
        .from('scheduled_posts')
        .update({
          queue_slot_id: next.slot.id,
          scheduled_at,
          status: 'scheduled',
        })
        .eq('id', input.scheduledPostId)

      if (updErr) throw new Error(`assignToSlot: failed to write queue assignment: ${updErr.message}`)
      return { slot_id: next.slot.id, scheduled_at }
    }

    // Taken — push this slot to its next occurrence and try again.
    next.occurrence = nextOccurrence(next.slot, next.occurrence)
    if (next.occurrence.getTime() > horizonEnd.getTime()) {
      // This slot is fully booked within the horizon — drop it.
      candidates.shift()
    }
  }

  return null
}

/**
 * Clear a draft's queue assignment without changing its status. Use
 * when the user moves a queued draft back to "Custom time" or "Now".
 */
export async function unassignFromSlot(
  supabase: SupabaseClient,
  scheduledPostId: string,
): Promise<void> {
  const { error } = await supabase
    .from('scheduled_posts')
    .update({ queue_slot_id: null })
    .eq('id', scheduledPostId)

  if (error) throw new Error(`unassignFromSlot: ${error.message}`)
}
