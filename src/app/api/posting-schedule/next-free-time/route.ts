/**
 * "Add to next free time" — the answer, before the owner presses anything.
 *
 * ── The fault ──────────────────────────────────────────────────────────
 * The composer's second button was dead. It read the week's times in the
 * browser, took the soonest occurrence and never asked whether a post was
 * already sitting on it — and with no times set at all, it was simply disabled
 * with a tooltip nobody hovers. Pressing it scheduled into nothing, or onto a
 * minute that was already spoken for, and said neither.
 *
 * This route answers three things the button has to be able to say out loud:
 *   · is there a time at all (and if not, where does the owner go to set one);
 *   · which time is genuinely next, with nothing already on it;
 *   · what that time is called in the owner's own words — "Tuesday 9:00am".
 *
 * ── Why it is a GET on its own path ────────────────────────────────────
 * It reads and never writes. Nothing here books a time, and pressing the button
 * is what schedules the post — through `createDraftPost`, carrying the slot id
 * back, so the row owns the time it was given.
 *
 * ── Two places a week can live ─────────────────────────────────────────
 * A business publishing through the main connection keeps its week with the
 * publisher's own queue, which has no ids we may store; one on the backup
 * connection keeps it in `posting_schedule_slots`, which does. Both are read
 * here, local first, and the reply says which — because a time with an id can
 * be owned by the post that takes it, and a time without one can only be held
 * by the minute it falls on.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { listZernioQueues, previewZernioQueue } from '@/lib/zernio/queue'
import { userSafeError } from '@/lib/errors/user-safe'
import {
  bookedTimes,
  describePostingTime,
  DEFAULT_HORIZON_DAYS,
  firstFreeInstant,
  nextFreeTime,
  type WeeklyPostingTime,
} from '@/lib/posting-queue/next-free-time'

export const runtime = 'nodejs'

const DEFAULT_TIMEZONE = 'Australia/Brisbane'
/** Where the owner goes to set their week. Never a settings page they must find. */
const SET_TIMES_HREF = '/agency/social/schedule'
const DAY_MS = 86_400_000
/** Three weeks of queue times is more than enough to find a free one. */
const PREVIEW_COUNT = 21

export interface NextFreeTimeResponse {
  /** False means the owner has not set a week yet — offer to go and set one. */
  hasTimes: boolean
  /** The instant the post would go out, or null when there is none to offer. */
  when: string | null
  /** "Tuesday 9:00am", written in the business's own time zone. */
  label: string | null
  /** The time's id, when it is one we may put on the post's row. */
  slotId: string | null
  /** One id per network, so each network's row owns its own copy of the time. */
  slotIdByPlatform: Record<string, string>
  timezone: string
  /** What to say when there is no time to offer. Null when there is one. */
  message: string | null
  /** Where to send the owner when they have no times yet. */
  setTimesHref: string
}

function reply(body: Partial<NextFreeTimeResponse>): NextResponse {
  return NextResponse.json({
    hasTimes: false,
    when: null,
    label: null,
    slotId: null,
    slotIdByPlatform: {},
    timezone: DEFAULT_TIMEZONE,
    message: null,
    setTimesHref: SET_TIMES_HREF,
    ...body,
  } satisfies NextFreeTimeResponse)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  // RLS decides whether this person may see the business at all. A brand they
  // cannot read comes back empty and is answered as not found, never as an
  // empty week — the two mean very different things to the button.
  const { data: brand } = await supabase
    .from('brands')
    .select('id, social_urls')
    .eq('id', brandId)
    .maybeSingle()
  if (!brand) {
    return NextResponse.json({ error: 'That business could not be found.' }, { status: 404 })
  }

  const now = new Date()
  const horizon = new Date(now.getTime() + DEFAULT_HORIZON_DAYS * DAY_MS)

  try {
    /*
     * Everything already holding a time.
     *
     * An hour of slack behind `now` so a post scheduled a few minutes ago still
     * counts as holding its minute. Published and cancelled rows are left out:
     * one has been and gone, the other gave its time back.
     */
    const { data: booked } = await supabase
      .from('scheduled_posts')
      .select('scheduled_at, queue_slot_id, status')
      .eq('brand_id', brandId)
      .gte('scheduled_at', new Date(now.getTime() - 3_600_000).toISOString())
      .lte('scheduled_at', horizon.toISOString())
      .in('status', ['draft', 'scheduled', 'publishing'])

    const taken = bookedTimes(
      (booked ?? []) as Array<{ scheduled_at: string | null; queue_slot_id: string | null; status: string | null }>,
    )

    // ── The week, as the owner set it ──────────────────────────────────
    const { data: localRows } = await supabase
      .from('posting_schedule_slots')
      .select('id, day_of_week, time, timezone, platform')
      .eq('brand_id', brandId)

    const localSlots: WeeklyPostingTime[] = (localRows ?? []).map((row) => ({
      id: row.id as string,
      day_of_week: row.day_of_week as number,
      // Postgres hands back "09:00:00"; the arithmetic wants the hour and
      // minute and is indifferent to the seconds.
      time: String(row.time ?? '09:00').slice(0, 5),
      timezone: (row.timezone as string | null) ?? DEFAULT_TIMEZONE,
      platform: (row.platform as string | null) ?? null,
    }))

    if (localSlots.length > 0) {
      const free = nextFreeTime(localSlots, taken, now, { fallbackTimezone: DEFAULT_TIMEZONE })
      if (!free) {
        return reply({
          hasTimes: true,
          timezone: localSlots[0]?.timezone ?? DEFAULT_TIMEZONE,
          message:
            'Every one of your posting times over the next four weeks already has a post on it. ' +
            'Choose a time instead, or add another time to your week.',
        })
      }
      return reply({
        hasTimes: true,
        when: free.when.toISOString(),
        label: describePostingTime(free.when, free.timezone, now),
        slotId: free.slotId,
        slotIdByPlatform: free.slotIdByPlatform,
        timezone: free.timezone,
      })
    }

    // ── Or the week kept with the publisher ────────────────────────────
    const profileId = zernioProfileIdFromSocialUrls(brand.social_urls)
    if (!profileId) {
      return reply({
        message: 'You have not set any posting times yet, so there is no next free time to offer.',
      })
    }

    const view = await listZernioQueues({ profileId })
    const schedule = view.schedules[0] ?? null
    if (!schedule || schedule.slots.length === 0) {
      return reply({
        timezone: schedule?.timezone ?? DEFAULT_TIMEZONE,
        message: 'You have not set any posting times yet, so there is no next free time to offer.',
      })
    }

    const timezone = schedule.timezone || DEFAULT_TIMEZONE

    /*
     * The upcoming times, from the schedule itself.
     *
     * Preferred over working them out here because it already knows what it has
     * booked. It is read, filtered against what we have on those minutes, and
     * offered — nothing is handed to the schedule to book, so there is no lock
     * being skipped: the post is ours, scheduled by us, at a time the owner can
     * see before they press.
     */
    let upcoming: string[] = view.nextSlots
    try {
      const preview = await previewZernioQueue({
        profileId,
        queueId: schedule.queueId,
        count: PREVIEW_COUNT,
      })
      if (preview.length > 0) upcoming = preview
    } catch (err) {
      console.error('[posting-schedule/next-free-time] preview failed:', err)
    }

    let when = firstFreeInstant(upcoming, taken, now)

    if (!when) {
      // No preview to read, or every previewed time is taken. The week itself
      // still says when the times fall, so it is walked directly.
      const weekly: WeeklyPostingTime[] = schedule.slots.map((slot) => ({
        // No id: `queue_slot_id` points at the local table, and inventing a
        // value that looks like one would break the post's row on insert.
        id: null,
        day_of_week: slot.dayOfWeek,
        time: slot.time,
        timezone,
      }))
      const free = nextFreeTime(weekly, taken, now, { fallbackTimezone: timezone })
      when = free ? free.when.toISOString() : null
    }

    if (!when) {
      return reply({
        hasTimes: true,
        timezone,
        message:
          'Every one of your posting times over the next four weeks already has a post on it. ' +
          'Choose a time instead, or add another time to your week.',
      })
    }

    return reply({
      hasTimes: true,
      when,
      label: describePostingTime(new Date(when), timezone, now),
      timezone,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'posting-schedule/next-free-time',
          err,
          'Your posting times could not be read just now. Try again in a moment.',
        ),
      },
      { status: 502 },
    )
  }
}
