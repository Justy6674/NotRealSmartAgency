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

function zonedDateTimeToUtc(
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
