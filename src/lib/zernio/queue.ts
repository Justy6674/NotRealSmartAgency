/**
 * The posting schedule — the real one, on the publisher.
 *
 * Depended on by: the posting-schedule page and "add to queue" (S4), and the
 * composer's next-free-time hint (S3).
 *
 * ── What this replaces ─────────────────────────────────────────────────
 * NRS had a posting-schedule grid, a slot editor and an API, and the page told
 * the owner "drop drafts into the queue and they will publish at the next open
 * slot". `assignToSlot` and `unassignFromSlot` had ZERO callers, so
 * `queue_slot_id` was never written, every per-slot count was permanently 0 and
 * the publish cron never looked at a slot. The promise on the page was not
 * true. This module backs it with the queue that actually schedules posts.
 *
 * Live on 2026-08-18: no queue exists on any NRS profile
 * (`{exists:false, schedule:null, nextSlots:[]}`), so this is greenfield.
 *
 * ── Two rules that cost data if broken ─────────────────────────────────
 * 1. `deleteQueueSlot` without a `queueId` deletes EVERY queue on the profile.
 *    `deleteZernioQueue` therefore requires one and will not send the call
 *    without it.
 * 2. Never read `getNextQueueSlot` and pass that time as `scheduledFor`. That
 *    bypasses the queue's own locking and double-books the slot. Schedule into
 *    a queue with `queuedFromProfile` (see `createZernioPost`) and let the
 *    publisher choose the time.
 */

import { getZernioClient } from './client'
import { unwrapZernio, ZernioError } from './errors'
import { zernioIdOf, type ZernioQueueSchedule, type ZernioQueueSlot, type ZernioQueueView } from './types'

function slotsOf(raw: unknown): ZernioQueueSlot[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry) => {
    const rec = (entry ?? {}) as Record<string, unknown>
    const dayOfWeek = typeof rec.dayOfWeek === 'number' ? rec.dayOfWeek : null
    const time = typeof rec.time === 'string' ? rec.time : ''
    if (dayOfWeek === null || dayOfWeek < 0 || dayOfWeek > 6 || !time) return []
    return [{ dayOfWeek, time }]
  })
}

function scheduleOf(raw: unknown): ZernioQueueSchedule | null {
  const rec = (raw ?? {}) as Record<string, unknown>
  const queueId = zernioIdOf(rec)
  if (!queueId) return null
  return {
    queueId,
    name: typeof rec.name === 'string' ? rec.name : 'Posting schedule',
    timezone: typeof rec.timezone === 'string' ? rec.timezone : 'UTC',
    active: rec.active !== false,
    isDefault: rec.isDefault === true || rec.default === true,
    slots: slotsOf(rec.slots),
  }
}

function viewOf(raw: unknown): ZernioQueueView {
  const data = (raw ?? {}) as Record<string, unknown>
  const schedules: ZernioQueueSchedule[] = []

  if (Array.isArray(data.queues)) {
    for (const queue of data.queues) {
      const parsed = scheduleOf(queue)
      if (parsed) schedules.push(parsed)
    }
  }
  const single = scheduleOf(data.schedule)
  if (single && !schedules.some((s) => s.queueId === single.queueId)) schedules.push(single)

  const nextSlots = Array.isArray(data.nextSlots)
    ? data.nextSlots.flatMap((slot) => {
        if (typeof slot === 'string') return [slot]
        const rec = (slot ?? {}) as Record<string, unknown>
        const at = rec.time ?? rec.scheduledFor ?? rec.date
        return typeof at === 'string' ? [at] : []
      })
    : []

  return {
    // `exists` is taken from the payload when it is there, and inferred from
    // the schedules otherwise. An empty grid must read as "no schedule yet",
    // never as "your schedule is empty" — those are different sentences to the
    // owner and only one of them is actionable.
    exists: data.exists === true || schedules.length > 0,
    schedules,
    nextSlots,
  }
}

export async function listZernioQueues(params: {
  profileId: string
  queueId?: string
  /** True lists every queue on the profile, not just the default. */
  all?: boolean
}): Promise<ZernioQueueView> {
  const zernio = getZernioClient('queue.listQueueSlots')
  const result = await zernio.queue.listQueueSlots({
    query: {
      profileId: params.profileId,
      ...(params.queueId ? { queueId: params.queueId } : {}),
      ...(params.all !== undefined ? { all: params.all ? 'true' as const : 'false' as const } : {}),
    },
  })
  return viewOf(unwrapZernio<Record<string, unknown>>('queue.listQueueSlots', result as never))
}

export async function createZernioQueue(params: {
  profileId: string
  name: string
  /** IANA zone, e.g. `Australia/Brisbane`. Not an offset. */
  timezone: string
  slots: ZernioQueueSlot[]
  active?: boolean
}): Promise<ZernioQueueSchedule | null> {
  const zernio = getZernioClient('queue.createQueueSlot')
  const result = await zernio.queue.createQueueSlot({
    body: {
      profileId: params.profileId,
      name: params.name,
      timezone: params.timezone,
      slots: params.slots,
      active: params.active ?? true,
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('queue.createQueueSlot', result as never)
  return scheduleOf(data.queue ?? data.schedule ?? data)
}

export async function updateZernioQueue(params: {
  profileId: string
  queueId: string
  timezone: string
  slots: ZernioQueueSlot[]
  name?: string
  active?: boolean
  setAsDefault?: boolean
  /** Move posts already queued onto the new times. Off by default. */
  reshuffleExisting?: boolean
}): Promise<void> {
  const zernio = getZernioClient('queue.updateQueueSlot')
  const result = await zernio.queue.updateQueueSlot({
    body: {
      profileId: params.profileId,
      queueId: params.queueId,
      timezone: params.timezone,
      slots: params.slots,
      ...(params.name ? { name: params.name } : {}),
      ...(params.active !== undefined ? { active: params.active } : {}),
      ...(params.setAsDefault !== undefined ? { setAsDefault: params.setAsDefault } : {}),
      ...(params.reshuffleExisting !== undefined
        ? { reshuffleExisting: params.reshuffleExisting }
        : {}),
    },
  })
  if (result.error) {
    throw new ZernioError('queue.updateQueueSlot', 'The posting times could not be saved.', {
      cause: result.error,
    })
  }
}

/**
 * Delete ONE queue.
 *
 * `queueId` is required here and is not optional upstream by accident: omitting
 * it on the API deletes every queue on the profile. A UI delete button is one
 * click, and one click should never be able to wipe a business's whole posting
 * schedule because an id was undefined.
 */
export async function deleteZernioQueue(params: {
  profileId: string
  queueId: string
}): Promise<void> {
  if (!params.queueId?.trim()) {
    throw new ZernioError(
      'queue.deleteQueueSlot',
      'Refusing to delete a posting schedule without naming which one — ' +
        'the API deletes every queue on the profile when the id is missing.',
    )
  }
  const zernio = getZernioClient('queue.deleteQueueSlot')
  const result = await zernio.queue.deleteQueueSlot({
    query: { profileId: params.profileId, queueId: params.queueId },
  })
  if (result.error) {
    throw new ZernioError('queue.deleteQueueSlot', 'The posting schedule could not be removed.', {
      cause: result.error,
    })
  }
}

/** The next N times this queue would use. Display only. */
export async function previewZernioQueue(params: {
  profileId: string
  count?: number
  queueId?: string
}): Promise<string[]> {
  const zernio = getZernioClient('queue.previewQueue')
  const result = await zernio.queue.previewQueue({
    query: {
      profileId: params.profileId,
      count: params.count ?? 5,
      ...(params.queueId ? { queueId: params.queueId } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('queue.previewQueue', result as never)
  const slots = data.slots ?? data.preview ?? data.nextSlots
  if (!Array.isArray(slots)) return []
  return slots.flatMap((slot) => {
    if (typeof slot === 'string') return [slot]
    const rec = (slot ?? {}) as Record<string, unknown>
    const at = rec.time ?? rec.scheduledFor ?? rec.date
    return typeof at === 'string' ? [at] : []
  })
}

/**
 * The next free time, FOR DISPLAY ONLY.
 *
 * Do not copy the answer into `scheduledFor`. The queue takes a lock when it
 * assigns a slot; a time read here and passed back as a fixed schedule skips
 * that lock, and two posts land on the same minute. To actually queue a post,
 * pass `queuedFromProfile` to `createZernioPost`.
 */
export async function nextZernioQueueSlot(params: {
  profileId: string
  queueId?: string
}): Promise<string | null> {
  const zernio = getZernioClient('queue.getNextQueueSlot')
  const result = await zernio.queue.getNextQueueSlot({
    query: {
      profileId: params.profileId,
      ...(params.queueId ? { queueId: params.queueId } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('queue.getNextQueueSlot', result as never)
  const slot = data.nextSlot ?? data.slot ?? data.time
  if (typeof slot === 'string') return slot
  const rec = (slot ?? {}) as Record<string, unknown>
  const at = rec.time ?? rec.scheduledFor ?? rec.date
  return typeof at === 'string' ? at : null
}
