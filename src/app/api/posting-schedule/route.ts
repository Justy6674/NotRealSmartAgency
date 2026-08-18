/**
 * The posting schedule — backed by the queue that actually schedules posts.
 *
 * ── What this replaces ─────────────────────────────────────────────────
 * The page said: "Drop drafts into the queue and they will publish at the next
 * open slot." It was not true. `assignToSlot`/`unassignFromSlot` had zero
 * callers, so `queue_slot_id` was never written, every per-slot count was
 * permanently 0, and the publish cron never looked at a slot. The grid was a
 * drawing of a schedule.
 *
 * When a business is on the main posting connection, the grid is now the real
 * queue: the times it shows are the times `previewQueue` returns, and a draft
 * added to the queue is scheduled by the queue's own locking rather than by us
 * reading a time and copying it into `scheduledFor` — which is explicitly
 * warned against upstream because it double-books the slot.
 *
 * ── The fallback is not a lie either ───────────────────────────────────
 * A business on the backup connection has no queue to read. Rather than
 * pretending, it keeps the local `posting_schedule_slots` table and the
 * response says `source: 'local'`, which the page turns into an honest sentence
 * about what those times are: a plan, offered when you schedule, not a queue
 * that fires by itself.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import {
  createZernioQueue,
  deleteZernioQueue,
  listZernioQueues,
  previewZernioQueue,
  updateZernioQueue,
} from '@/lib/zernio/queue'
import { createZernioPost } from '@/lib/zernio/client'
import { listZernioAccounts } from '@/lib/zernio/accounts'
import { fetchZernioBestTimeToPost } from '@/lib/zernio/insights'
import { connectedAccounts } from '@/lib/mixpost/connected-platforms'
import { buildCaption } from '@/lib/publishers/dispatcher'
import { checkPublishAllowed } from '@/lib/agents/publish-gate'
import type { ZernioQueueSlot } from '@/lib/zernio/types'
import { userSafeError } from '@/lib/errors/user-safe'

export const runtime = 'nodejs'

const DEFAULT_TIMEZONE = 'Australia/Brisbane'
const QUEUE_NAME = 'Posting schedule'
/** How far ahead the preview looks. Three weeks covers any weekly grid. */
const PREVIEW_COUNT = 21

export interface DeskScheduleResponse {
  source: 'queue' | 'local'
  timezone: string
  queueId: string | null
  /**
   * The week, one entry per time — NOT one per time per network.
   *
   * A posting time is a time: 9:00am means every account this business has
   * connected. That is the decision the owner actually makes, and it is the
   * only one that survives contact with somebody who thinks in "when do we
   * post", not in networks.
   *
   * `platforms` is therefore normally empty, meaning "everywhere". It is only
   * non-empty when a time covers SOME of the connected accounts and not all of
   * them — which the local table can express and older rows sometimes do. In
   * that case the grid names them, rather than quietly implying the time is
   * broader than it is.
   */
  slots: Array<{
    id: string
    day_of_week: number
    time: string
    platforms: string[]
    upcoming: number
  }>
  /** Everywhere a time on this grid will post. Owner-facing labels. */
  accounts: Array<{ platform: string; label: string }>
  /** The next real times, straight from the queue. Empty in local mode. */
  nextSlots: string[]
  /**
   * When this business's own audience actually engages, strongest first.
   *
   * Mixpost has no equivalent and neither did we, so the owner set times by
   * feel. Read in the queue's own zone here, because the upstream answer is in
   * UTC hours and counts 0 as MONDAY while the queue counts 0 as Sunday —
   * mixing the two conventions shifts every recommendation by a day.
   *
   * These are the RAW converted slots, thin ones included. Whether there is
   * enough here to put in front of the owner as a measurement is decided by
   * `audienceRhythm` in the page's own `rhythms.ts`, which is a pure function
   * with tests — not by a threshold buried in a network call.
   */
  bestTimes: Array<{ day_of_week: number; time: string; posts: number }>
  /** How many published posts the answer above was worked out from. */
  bestTimesPostsCounted: number
  /** Set when the queue could not be read at all. */
  unavailable?: string
}

function isDay(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6
}

function toHHMM(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${match[1]}:${match[2]}`
}

/** A stable id for a queue slot, which upstream gives no id of its own. */
function slotId(dayOfWeek: number, time: string): string {
  return `d${dayOfWeek}t${time}`
}

function parseSlotId(id: string): { dayOfWeek: number; time: string } | null {
  const match = /^d([0-6])t(\d{2}:\d{2})$/.exec(id)
  if (!match) return null
  return { dayOfWeek: Number(match[1]), time: match[2]! }
}

async function profileFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('brands')
    .select('social_urls')
    .eq('id', brandId)
    .maybeSingle()
  return zernioProfileIdFromSocialUrls(data?.social_urls)
}

/**
 * Read the queue and count what is actually coming up in each slot.
 *
 * The counts are derived from `previewQueue`, not invented here, which is the
 * whole point: the number beside a time is the number of posts the queue itself
 * says will go out at that time. That is what makes the page's promise checkable
 * rather than decorative.
 */
async function readQueue(profileId: string, timezone: string): Promise<DeskScheduleResponse> {
  const view = await listZernioQueues({ profileId })
  const schedule = view.schedules[0] ?? null

  const slots = (schedule?.slots ?? []).map((slot) => ({
    id: slotId(slot.dayOfWeek, slot.time),
    day_of_week: slot.dayOfWeek,
    time: slot.time,
    // The queue belongs to the business, not to one network. Every time on it
    // reaches every connected account, so there is nothing to narrow here.
    platforms: [] as string[],
    upcoming: 0,
  }))

  let nextSlots: string[] = view.nextSlots
  if (schedule) {
    try {
      nextSlots = await previewZernioQueue({
        profileId,
        queueId: schedule.queueId,
        count: PREVIEW_COUNT,
      })
    } catch (err) {
      console.error('[posting-schedule] preview failed:', err)
    }
  }

  const zone = schedule?.timezone ?? timezone
  const counts = new Map<string, number>()
  for (const iso of nextSlots) {
    const when = new Date(iso)
    if (Number.isNaN(when.getTime())) continue
    // Read the instant back in the queue's own zone, so a Sunday-evening slot in
    // Brisbane is not counted against Saturday because UTC says so.
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: zone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(when)
    const weekday = parts.find((part) => part.type === 'weekday')?.value ?? ''
    const hour = parts.find((part) => part.type === 'hour')?.value ?? ''
    const minute = parts.find((part) => part.type === 'minute')?.value ?? ''
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
    if (dayOfWeek < 0 || !hour || !minute) continue
    const key = slotId(dayOfWeek, `${hour === '24' ? '00' : hour}:${minute}`)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  for (const slot of slots) {
    slot.upcoming = counts.get(slot.id) ?? 0
  }

  slots.sort((a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time))

  return {
    source: 'queue',
    timezone: zone,
    queueId: schedule?.queueId ?? null,
    slots,
    accounts: [],
    nextSlots,
    bestTimes: [],
    bestTimesPostsCounted: 0,
  }
}

/**
 * The best times to post, translated into the grid's own week.
 *
 * Two conversions, both easy to get wrong and both silent when you do:
 *   · the answer counts 0 as MONDAY, the queue counts 0 as SUNDAY;
 *   · the hour is UTC, and Brisbane runs ten hours ahead of it all year (no
 *     daylight saving here), which is enough to move a Sunday evening onto a
 *     Monday morning. The offset is never written down — `Intl` is given the
 *     brand's own timezone so a customer in a DST zone stays correct too.
 * Doing them here, once, keeps the page free of clock arithmetic.
 */
async function readBestTimes(
  profileId: string,
  timezone: string,
): Promise<{ times: DeskScheduleResponse['bestTimes']; postsCounted: number }> {
  const slots = await fetchZernioBestTimeToPost({ profileId, source: 'all' })
  if (slots.length === 0) return { times: [], postsCounted: 0 }

  // A reference Sunday in UTC, so day arithmetic starts from a known weekday.
  const reference = Date.UTC(2026, 0, 4) // 4 Jan 2026 was a Sunday.

  // Every slot, thin ones included, strongest first. The page decides what is
  // solid enough to offer — see `bestTimes` on the response type. Truncating to
  // a handful here would hide exactly the evidence that judgement needs.
  const times = slots
    .slice()
    .sort((a, b) => b.averageEngagement - a.averageEngagement)
    .flatMap((slot) => {
      // 0 = Monday upstream → 1 = Monday here.
      const sundayIndex = (slot.dayOfWeek + 1) % 7
      const instant = new Date(reference + sundayIndex * 86_400_000 + slot.hourUtc * 3_600_000)
      const parts = new Intl.DateTimeFormat('en-AU', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(instant)
      const weekday = parts.find((part) => part.type === 'weekday')?.value ?? ''
      const hour = parts.find((part) => part.type === 'hour')?.value ?? ''
      const minute = parts.find((part) => part.type === 'minute')?.value ?? ''
      const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
      if (dayOfWeek < 0 || !hour) return []
      return [{
        day_of_week: dayOfWeek,
        time: `${hour === '24' ? '00' : hour}:${minute || '00'}`,
        posts: slot.postCount,
      }]
    })

  return {
    times,
    // Counted over every slot Zernio answered with, not only the ones that
    // survive the page's own bar — this is "how much history is behind this",
    // and understating it would make a solid answer look like a guess.
    postsCounted: slots.reduce((total, slot) => total + slot.postCount, 0),
  }
}

/**
 * A local time's id, which stands for the whole group of rows behind it.
 *
 * The table's unique key is (brand, PLATFORM, day, time), so "post at 9:00am
 * Monday" is stored as one row per connected network. The owner did not make
 * four decisions, they made one, so the desk is handed one thing with one id
 * and every write behind it fans back out. Anchoring the id on the day and the
 * time rather than on one row's uuid is what makes that safe: remove a time and
 * all of its rows go, instead of three surviving invisibly.
 */
function localSlotId(dayOfWeek: number, time: string): string {
  return `local:${dayOfWeek}:${time}`
}

function parseLocalSlotId(id: string): { dayOfWeek: number; time: string } | null {
  const match = /^local:([0-6]):(\d{2}:\d{2})$/.exec(id)
  if (!match) return null
  return { dayOfWeek: Number(match[1]), time: match[2]! }
}

/**
 * Everywhere a posting time on this business's grid will actually post.
 *
 * Failure is answered as "we could not tell", not as "nowhere": the caller uses
 * this to decide how many rows a time becomes, and an empty answer taken as
 * fact would quietly save a week that posts to nothing.
 */
async function accountsFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
): Promise<DeskScheduleResponse['accounts'] | null> {
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, slug, social_urls')
    .eq('id', brandId)
    .maybeSingle()
  if (!brand) return null

  try {
    const accounts = await connectedAccounts({
      id: brand.id as string,
      name: (brand.name as string) ?? '',
      slug: (brand.slug as string) ?? '',
      ...(brand.social_urls ? { social_urls: brand.social_urls as Record<string, string> } : {}),
    })
    if (accounts.length === 0) return null
    // One entry per network, not one per account: two Instagram accounts are
    // still "Instagram" to somebody setting a posting time.
    const seen = new Set<string>()
    return accounts.flatMap((account) => {
      if (seen.has(account.provider)) return []
      seen.add(account.provider)
      return [{ platform: account.provider, label: account.label }]
    })
  } catch (err) {
    console.error('[posting-schedule] connected accounts could not be read:', err)
    return null
  }
}

async function readLocal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
  accounts: DeskScheduleResponse['accounts'] | null,
): Promise<DeskScheduleResponse> {
  const { data, error } = await supabase
    .from('posting_schedule_slots')
    .select('*')
    .eq('brand_id', brandId)
    .order('day_of_week', { ascending: true })
    .order('time', { ascending: true })
  if (error) throw new Error(error.message)

  /*
   * Collapse the per-network rows back into the one decision that made them.
   *
   * A time keeps its network names ONLY when it covers some of the connected
   * accounts and not all of them — a shape older rows can have, and one the
   * grid has to say out loud rather than paper over. When it covers everything,
   * `platforms` is empty and the grid reads "all your accounts", which is true.
   */
  const connected = new Set((accounts ?? []).map((account) => account.platform))
  const groups = new Map<string, { day: number; time: string; platforms: Set<string> }>()
  for (const row of data ?? []) {
    const day = row.day_of_week as number
    const time = toHHMM(row.time) ?? '09:00'
    const key = localSlotId(day, time)
    const group = groups.get(key) ?? { day, time, platforms: new Set<string>() }
    const platform = typeof row.platform === 'string' ? row.platform : ''
    if (platform) group.platforms.add(platform)
    groups.set(key, group)
  }

  const slots = [...groups.entries()]
    .map(([id, group]) => {
      /*
       * Naming networks is a claim that the time is NARROWER than the whole
       * account list. When the account list could not be read there is nothing
       * to be narrow against, so the time is left unqualified rather than
       * labelled with whatever network happens to be on its rows — which on a
       * business with nothing connected would print "Facebook only" over a fact
       * nobody established.
       */
      const coversEverything =
        connected.size === 0 || [...connected].every((platform) => group.platforms.has(platform))
      return {
        id,
        day_of_week: group.day,
        time: group.time,
        platforms: coversEverything ? [] : [...group.platforms].sort(),
        // Nothing consults a local slot at publish time, so claiming a number
        // here would be the same untruth this rewrite removed.
        upcoming: 0,
      }
    })
    .sort((a, b) => a.day_of_week - b.day_of_week || a.time.localeCompare(b.time))

  return {
    source: 'local',
    timezone: (data ?? [])[0]?.timezone ?? DEFAULT_TIMEZONE,
    queueId: null,
    slots,
    accounts: accounts ?? [],
    nextSlots: [],
    bestTimes: [],
    bestTimesPostsCounted: 0,
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  if (!brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  const wantsDesk = searchParams.get('desk') === '1'

  const profileId = await profileFor(supabase, brandId)

  try {
    // Only the desk needs to know where a time posts. The composer asks this
    // route for the next free time on every draft, and making that pay for an
    // accounts lookup it never reads would be a network call per keystroke.
    const accounts = wantsDesk ? await accountsFor(supabase, brandId) : null

    const view = profileId
      ? await readQueue(profileId, DEFAULT_TIMEZONE)
      : await readLocal(supabase, brandId, accounts)
    if (wantsDesk && accounts) view.accounts = accounts

    if (wantsDesk) {
      // Advice is a nicety; the grid is the point. A best-time lookup that
      // fails must cost the hint and nothing else — and it is only fetched
      // when a caller asks for it, so the posts list checking whether a queue
      // exists does not quietly make an analytics call as well.
      if (profileId && searchParams.get('hints') === '1') {
        try {
          const best = await readBestTimes(profileId, view.timezone)
          view.bestTimes = best.times
          view.bestTimesPostsCounted = best.postsCounted
        } catch (err) {
          console.error('[posting-schedule] best times could not be read:', err)
        }
      }
      return NextResponse.json(view)
    }

    /*
     * The plain array the composer still reads.
     *
     * It asks this route for the next free time and feeds the answer to
     * `earliestNextSlot`, which wants `day_of_week`, `time` and `timezone`.
     * Keeping that shape available is not backwards-compatibility for its own
     * sake — it means the composer's "next free time" hint now comes from the
     * REAL queue on a business that has one, instead of from a local table
     * nothing consulted at publish time.
     */
    return NextResponse.json(
      view.slots.map((slot) => ({
        id: slot.id,
        brand_id: brandId,
        // `earliestNextSlot` reads day, time and zone; the platform is along
        // for the ride. An empty `platforms` means the time covers everything,
        // and the caller's shape wants a single string.
        platform: slot.platforms[0] ?? 'facebook',
        day_of_week: slot.day_of_week,
        time: slot.time,
        timezone: view.timezone,
      })),
    )
  } catch (err) {
    // A queue that cannot be read must not silently fall back to the local
    // table: the two are different schedules, and quietly showing the wrong one
    // is how the owner ends up editing times that do nothing.
    if (!wantsDesk) {
      console.error('[posting-schedule/read] falling back to no slots:', err)
      return NextResponse.json([])
    }
    return NextResponse.json(
      {
        source: profileId ? 'queue' : 'local',
        timezone: DEFAULT_TIMEZONE,
        queueId: null,
        slots: [],
        accounts: [],
        nextSlots: [],
        bestTimes: [],
        bestTimesPostsCounted: 0,
        unavailable: userSafeError(
          'posting-schedule/read',
          err,
          'Your posting times could not be loaded just now. Try again in a moment.',
        ),
      } satisfies DeskScheduleResponse,
      { status: 200 },
    )
  }
}

/* ── Writing the grid ────────────────────────────────────────────────────── */

/**
 * Save the whole week at once.
 *
 * The queue takes its slots as one list, not one row at a time, so every write
 * here is a replace: the page sends the grid it wants and this makes it so.
 * Sending a partial list would silently drop the days it left out.
 */
async function writeQueue(
  profileId: string,
  slots: ZernioQueueSlot[],
  timezone: string,
): Promise<void> {
  const view = await listZernioQueues({ profileId })
  const existing = view.schedules[0] ?? null

  if (!existing) {
    await createZernioQueue({
      profileId,
      name: QUEUE_NAME,
      timezone,
      slots,
      active: true,
    })
    return
  }

  await updateZernioQueue({
    profileId,
    queueId: existing.queueId,
    timezone,
    slots,
    // Off deliberately. Moving every post already in the queue because the
    // owner nudged one time is a much bigger change than the one they made,
    // and it is not reversible from the grid.
    reshuffleExisting: false,
  })
}

interface WriteBody {
  brandId?: string
  timezone?: string
  /**
   * The complete week the owner wants, one entry per TIME.
   *
   * `platforms` is optional and normally absent, meaning "every account this
   * business has connected" — which is the decision the desk actually offers.
   * The local table's unique key includes the network, so an absent list is
   * fanned out to one row per connected network below; it is not dropped, and
   * it does not quietly become Facebook only.
   */
  slots?: Array<{ day_of_week?: unknown; time?: unknown; platforms?: unknown; platform?: unknown }>
}

/** A time's networks, from either the new field or the old single one. */
function platformsOf(entry: { platforms?: unknown; platform?: unknown }): string[] {
  if (Array.isArray(entry.platforms)) {
    return entry.platforms.filter((value): value is string => typeof value === 'string' && value !== '')
  }
  return typeof entry.platform === 'string' && entry.platform ? [entry.platform] : []
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as WriteBody | null
  if (!body?.brandId) return NextResponse.json({ error: 'brandId required' }, { status: 400 })

  const parsed: Array<{ dayOfWeek: number; time: string; platforms: string[] }> = []
  for (const entry of body.slots ?? []) {
    const time = toHHMM(entry.time)
    if (!isDay(entry.day_of_week) || !time) {
      return NextResponse.json({ error: 'One of those times could not be read.' }, { status: 400 })
    }
    parsed.push({ dayOfWeek: entry.day_of_week, time, platforms: platformsOf(entry) })
  }

  // Two identical times on the same day is one time. Collapsing here rather
  // than upstream keeps the grid and the queue agreeing about what was saved.
  const merged = new Map<string, { dayOfWeek: number; time: string; platforms: Set<string> }>()
  for (const slot of parsed) {
    const key = slotId(slot.dayOfWeek, slot.time)
    const existing = merged.get(key)
    if (existing) {
      // A time named twice is one time. If either mention covered everything,
      // the merged time covers everything — narrowing it would silently drop a
      // network the owner had just asked for.
      if (existing.platforms.size === 0 || slot.platforms.length === 0) existing.platforms.clear()
      else slot.platforms.forEach((platform) => existing.platforms.add(platform))
      continue
    }
    merged.set(key, {
      dayOfWeek: slot.dayOfWeek,
      time: slot.time,
      platforms: new Set(slot.platforms),
    })
  }
  const unique = [...merged.values()].map((slot) => ({
    dayOfWeek: slot.dayOfWeek,
    time: slot.time,
    platforms: [...slot.platforms],
  }))

  const timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : DEFAULT_TIMEZONE
  const profileId = await profileFor(supabase, body.brandId)

  try {
    if (profileId) {
      await writeQueue(
        profileId,
        unique.map((slot) => ({ dayOfWeek: slot.dayOfWeek, time: slot.time })),
        timezone,
      )
      return NextResponse.json(await readQueue(profileId, timezone))
    }

    /*
     * Local mode is still a whole-week replace, so the two modes behave the
     * same way from the page's point of view — but one TIME becomes one row per
     * connected network, because the table's unique key includes the network.
     *
     * When the connected accounts cannot be read, the previous behaviour is
     * kept rather than improvised: one Facebook row, exactly as before. Writing
     * nothing would lose the owner's week over a failed lookup, and guessing a
     * wider set would schedule onto accounts nobody confirmed exist.
     */
    const accounts = await accountsFor(supabase, body.brandId)
    const everywhere = (accounts ?? []).map((account) => account.platform)

    const { error: delError } = await supabase
      .from('posting_schedule_slots')
      .delete()
      .eq('brand_id', body.brandId)
    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

    const rows = unique.flatMap((slot) => {
      const platforms = slot.platforms.length > 0
        ? slot.platforms
        : everywhere.length > 0
          ? everywhere
          : ['facebook']
      return platforms.map((platform) => ({
        brand_id: body.brandId,
        platform,
        day_of_week: slot.dayOfWeek,
        time: slot.time,
        timezone,
      }))
    })

    if (rows.length > 0) {
      const { error: insError } = await supabase.from('posting_schedule_slots').insert(rows)
      if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })
    }

    return NextResponse.json(await readLocal(supabase, body.brandId, accounts))
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'posting-schedule/write',
          err,
          'Your posting times could not be saved just now. Try again in a moment.',
        ),
      },
      { status: 502 },
    )
  }
}

/**
 * Remove one time.
 *
 * A whole-week replace with that one time taken out, in both modes. There is
 * deliberately no "delete the schedule" here: upstream, a delete call without a
 * queue id removes EVERY queue on the profile, and no button on this desk
 * should be one missing parameter away from wiping a business's whole schedule.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const brandId = searchParams.get('brandId')
  const id = searchParams.get('id')
  const clearAll = searchParams.get('all') === '1'

  if (!brandId) {
    return NextResponse.json({ error: 'brandId is required' }, { status: 400 })
  }

  const profileId = await profileFor(supabase, brandId)

  /*
   * Clear every posting time.
   *
   * Mixpost has this control and we had none, so a business that wanted to
   * start its week again had to remove times one at a time. It is guarded three
   * ways rather than one, because upstream a delete call with the queue id
   * MISSING removes every queue on the profile:
   *   · the caller must name the queue it is clearing (`queueId`), so a bug
   *     that loses the id fails closed instead of deleting more than it meant;
   *   · the id must match the queue this business actually has;
   *   · `deleteZernioQueue` refuses an empty id on its own account.
   */
  if (clearAll) {
    const namedQueue = searchParams.get('queueId')?.trim()
    if (!namedQueue) {
      return NextResponse.json(
        { error: 'Reload the page and try again — we could not tell which schedule to clear.' },
        { status: 400 },
      )
    }

    try {
      if (!profileId) {
        const { error: delError } = await supabase
          .from('posting_schedule_slots')
          .delete()
          .eq('brand_id', brandId)
        if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })
        return NextResponse.json(
          await readLocal(supabase, brandId, await accountsFor(supabase, brandId)),
        )
      }

      const view = await listZernioQueues({ profileId })
      const existing = view.schedules.find((schedule) => schedule.queueId === namedQueue)
      if (!existing) {
        // The grid the owner clicked on is not the schedule that exists now.
        // Deleting the one that does exist would be deleting something they
        // have not seen.
        return NextResponse.json(await readQueue(profileId, DEFAULT_TIMEZONE))
      }

      await deleteZernioQueue({ profileId, queueId: existing.queueId })
      return NextResponse.json(await readQueue(profileId, existing.timezone))
    } catch (err) {
      return NextResponse.json(
        {
          error: userSafeError(
            'posting-schedule/clear-all',
            err,
            'Your posting times could not be cleared just now. Nothing has been changed.',
          ),
        },
        { status: 502 },
      )
    }
  }

  if (!id) {
    return NextResponse.json({ error: 'brandId and id are required' }, { status: 400 })
  }

  try {
    if (profileId) {
      const target = parseSlotId(id)
      if (!target) return NextResponse.json({ error: 'That time could not be read.' }, { status: 400 })
      const view = await listZernioQueues({ profileId })
      const existing = view.schedules[0]
      if (!existing) return NextResponse.json(await readQueue(profileId, DEFAULT_TIMEZONE))

      const remaining = existing.slots.filter(
        (slot) => !(slot.dayOfWeek === target.dayOfWeek && slot.time === target.time),
      )
      await updateZernioQueue({
        profileId,
        queueId: existing.queueId,
        timezone: existing.timezone,
        slots: remaining,
        reshuffleExisting: false,
      })
      return NextResponse.json(await readQueue(profileId, existing.timezone))
    }

    /*
     * One time, every row behind it.
     *
     * The desk's id names a day and a time, not a uuid, precisely so that
     * removing 9:00am Monday removes it everywhere rather than leaving three
     * network rows the grid no longer shows. A raw uuid is still accepted, so
     * an older client deleting one row keeps working.
     */
    const target = parseLocalSlotId(id)
    let error: { message: string } | null = null
    if (target) {
      /*
       * Matched in code rather than with a `time` filter on the query.
       * `posting_schedule_slots.time` is a Postgres `time`, so it comes back as
       * "09:00:00" while the desk's id carries "09:00"; relying on the cast to
       * make those equal is the sort of assumption that deletes nothing and
       * reports success. Reading the rows and comparing normalised values is
       * unambiguous.
       */
      const { data: rows, error: readError } = await supabase
        .from('posting_schedule_slots')
        .select('id, day_of_week, time')
        .eq('brand_id', brandId)
        .eq('day_of_week', target.dayOfWeek)
      if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })

      const doomed = (rows ?? [])
        .filter((row) => toHHMM(row.time) === target.time)
        .map((row) => row.id as string)
      if (doomed.length > 0) {
        ;({ error } = await supabase.from('posting_schedule_slots').delete().in('id', doomed))
      }
    } else {
      ;({ error } = await supabase
        .from('posting_schedule_slots')
        .delete()
        .eq('brand_id', brandId)
        .eq('id', id))
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(
      await readLocal(supabase, brandId, await accountsFor(supabase, brandId)),
    )
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'posting-schedule/delete',
          err,
          'That time could not be removed just now. Try again in a moment.',
        ),
      },
      { status: 502 },
    )
  }
}

/* ── Add to queue ────────────────────────────────────────────────────────── */

/**
 * The fourth leave-mode.
 *
 * Mixpost gives a post four ways to leave the composer — save as draft,
 * schedule it, add it to the queue, post it now. NRS had three: the queue arm
 * was plumbed as far as the publisher's own API and never called from anywhere
 * in the product, while the posting-schedule page told the owner that drafts
 * dropped into the queue would go out at the next open time. This is the call
 * that makes that sentence true.
 *
 * ── Why the time is not chosen here ────────────────────────────────────
 * There is a "next free time" endpoint upstream and it is tempting to read it
 * and hand the answer back as a fixed schedule. Its own documentation warns
 * against exactly that: the queue takes a lock when it assigns a slot, and a
 * time read and copied skips the lock, so two posts land on the same minute.
 * `queuedFromProfile` hands the choice to the queue, which is the only thing
 * that can make it safely.
 *
 * ── Why this cannot publish something unreviewed ───────────────────────
 * The button is on a draft, and a person presses it. Nothing here promotes a
 * post on its own, on a timer, or in a batch.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | { brandId?: string; postId?: string }
    | null
  if (!body?.brandId || !body?.postId) {
    return NextResponse.json({ error: 'brandId and postId are required' }, { status: 400 })
  }

  // RLS decides whether this person may see the business at all; a brand they
  // cannot read comes back empty and is answered as not found rather than as
  // an empty schedule.
  const { data: brand } = await supabase
    .from('brands')
    .select('id, slug, social_urls, post_signature, compliance_flags, brand_dna_constraints')
    .eq('id', body.brandId)
    .maybeSingle()
  if (!brand) return NextResponse.json({ error: 'That business could not be found.' }, { status: 404 })

  const profileId = zernioProfileIdFromSocialUrls(brand.social_urls)
  if (!profileId) {
    return NextResponse.json(
      {
        error:
          'This business posts through the backup connection, which has no queue. ' +
          'Pick a time for this post instead.',
      },
      { status: 409 },
    )
  }

  const { data: post } = await supabase
    .from('scheduled_posts')
    .select('id, brand_id, caption, hashtags, platform, media_item_ids, media_item_id, status, metadata')
    .eq('id', body.postId)
    .eq('brand_id', body.brandId)
    .maybeSingle()
  if (!post) return NextResponse.json({ error: 'That post could not be found.' }, { status: 404 })

  if (post.status !== 'draft') {
    return NextResponse.json(
      { error: 'Only a draft can be added to the queue. This one has already been sent on its way.' },
      { status: 409 },
    )
  }

  const platform = String(post.platform ?? '').toLowerCase()
  if (!platform || platform === 'twitter' || platform === 'x') {
    return NextResponse.json(
      { error: 'That network is not one this desk posts to.' },
      { status: 400 },
    )
  }

  try {
    const view = await listZernioQueues({ profileId })
    const schedule = view.schedules[0] ?? null
    if (!schedule || schedule.slots.length === 0) {
      return NextResponse.json(
        {
          error:
            'You have not set any posting times yet, so there is nowhere for this to go. ' +
            'Add a time to your week first.',
        },
        { status: 409 },
      )
    }

    const accounts = (await listZernioAccounts({ profileId, status: 'connected' })).filter(
      (account) => account.platform === platform,
    )
    if (accounts.length === 0) {
      return NextResponse.json(
        { error: `There is no ${platform} account connected for this business.` },
        { status: 409 },
      )
    }

    const mediaIds = Array.isArray(post.media_item_ids) && post.media_item_ids.length > 0
      ? (post.media_item_ids as string[])
      : post.media_item_id
        ? [post.media_item_id as string]
        : []
    let mediaUrls: string[] = []
    if (mediaIds.length > 0) {
      const { data: media } = await supabase
        .from('media_items')
        .select('id, file_url')
        .in('id', mediaIds)
      // Ordered the way the owner arranged them, not the way Postgres returned
      // them — a carousel whose slides swap places is a different post.
      const byId = new Map((media ?? []).map((row) => [row.id as string, row.file_url as string]))
      mediaUrls = mediaIds.map((id) => byId.get(id)).filter((url): url is string => !!url)
    }

    const signature = typeof brand.post_signature === 'string' ? brand.post_signature : undefined
    const content = buildCaption({
      caption: String(post.caption ?? ''),
      hashtags: (post.hashtags as string[] | null) ?? undefined,
      ...(signature ? { signature } : {}),
    })

    /*
     * The gate at the exit, not a gate in the caller.
     *
     * A post handed to the queue reaches a live account without ever passing
     * through the publish cron, so the check the cron performs has to happen
     * here or this becomes the one door out with nobody on it. It reviews the
     * exact words being sent, sign-off and hashtags included, because that is
     * the string the public will read.
     *
     * This is a safety net behind the person who pressed the button, not the
     * approval itself — the approval is that a human pressed it.
     */
    const gate = await checkPublishAllowed({
      content,
      complianceFlags: brand.compliance_flags as never,
      brandDNA: brand.brand_dna_constraints as never,
      brandSlug: typeof brand.slug === 'string' ? brand.slug : null,
      label: `queued post ${post.id}`,
    })
    if (!gate.allowed) {
      // The gate writes its reason for the owner, so it is relayed as written
      // rather than replaced with a generic sentence.
      return NextResponse.json(
        { error: gate.reason ?? 'This post did not pass the publishing check, so nothing was queued.' },
        { status: 422 },
      )
    }
    if (gate.warnings.length > 0) {
      console.log(`[posting-schedule/add-to-queue] warnings for post ${post.id}:`, gate.warnings)
    }

    const created = await createZernioPost({
      content,
      accounts: accounts.map((account) => ({ platform, accountId: account.id })),
      ...(mediaUrls.length > 0 ? { mediaUrls } : {}),
      queuedFromProfile: profileId,
      queueId: schedule.queueId,
      nrsScheduledPostId: post.id as string,
      metadata: { source: 'posting-schedule/add-to-queue' },
    })

    const externalId =
      created && typeof created === 'object'
        ? ((created as Record<string, unknown>)._id ?? (created as Record<string, unknown>).id)
        : null

    if (typeof externalId !== 'string' || !externalId) {
      return NextResponse.json(
        { error: 'The queue did not confirm this post. Nothing has been scheduled.' },
        { status: 502 },
      )
    }

    /*
     * `publishing`, not `scheduled`, and the difference matters.
     *
     * The publish cron takes every row that is `scheduled` with a time in the
     * past and sends it itself. A queued post is already with the publisher, so
     * a row left in that state would go out twice — once from the queue and
     * once from us. `publishing` is the state the cron reconciles rather than
     * re-sends: it asks the publisher what happened to this external id and
     * settles the row on the answer.
     */
    const metadata = {
      ...((post.metadata as Record<string, unknown>) ?? {}),
      queued_at: new Date().toISOString(),
      queue_id: schedule.queueId,
    }
    const { error: updateError } = await supabase
      .from('scheduled_posts')
      .update({ status: 'publishing', external_post_id: externalId, error: null, metadata })
      .eq('id', post.id)
    if (updateError) {
      // The post IS queued at this point. Saying otherwise would invite the
      // owner to queue it a second time.
      console.error('[posting-schedule/add-to-queue] queued but not recorded:', updateError.message)
      return NextResponse.json({
        queued: true,
        message: 'It is in the queue. Your list may take a moment to catch up.',
      })
    }

    let when: string | null = null
    try {
      const upcoming = await previewZernioQueue({
        profileId,
        queueId: schedule.queueId,
        count: 1,
      })
      when = upcoming[0] ?? null
    } catch {
      // A preview is a courtesy. It cannot fail a post that is already queued.
    }

    return NextResponse.json({
      queued: true,
      nextTime: when,
      message: when
        ? `Added to the queue. Next free time is ${new Date(when).toLocaleString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}.`
        : 'Added to the queue. It will go out at the next free time.',
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: userSafeError(
          'posting-schedule/add-to-queue',
          err,
          'This could not be added to the queue just now. Nothing has been scheduled.',
        ),
      },
      { status: 502 },
    )
  }
}
