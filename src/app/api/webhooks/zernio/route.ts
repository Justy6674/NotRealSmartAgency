/**
 * What the publisher tells us after a post leaves.
 *
 * Depended on by: the post activity thread (S4), the engagement desk (S6) and
 * the "waiting on you" count (S2).
 *
 * ── The lopsided timeline this fixes ───────────────────────────────────
 * System events — created, scheduled, published, failed — were written into
 * `post_activity` by the FALLBACK webhook only. This handler wrote
 * `publisher_runs` and inbox rows and never a single activity row. So for
 * exactly the businesses on the main connection, the activity thread showed
 * team comments and nothing else: a post could publish, fail and be taken off
 * the platform without one line appearing where the owner looks.
 *
 * Nine more event types are subscribed as of this slice — see
 * `scripts/register-zernio-webhook.ts`, which owns the subscription itself.
 * `post.platform.deleted` is the one that matters most: it is the signal that a
 * published health post has vanished from the platform, which for an AHPRA or
 * TGA brand is a fact somebody needs to see.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyZernioWebhook } from './verify'

export const dynamic = 'force-dynamic'

function eventIdOf(payload: Record<string, unknown>, headers: Headers): string | null {
  const fromPayload = typeof payload.id === 'string' ? payload.id.trim() : ''
  if (fromPayload) return fromPayload
  const fromHeader = (headers.get('x-zernio-event-id') ?? headers.get('x-late-event-id') ?? '').trim()
  return fromHeader || null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function accountIdOf(value: unknown): string {
  if (typeof value === 'string') return value
  const rec = asRecord(value)
  if (!rec) return ''
  const id = rec.id ?? rec._id ?? rec.accountId
  return typeof id === 'string' ? id : ''
}

export async function POST(request: Request) {
  const signature = request.headers.get('x-zernio-signature') ?? request.headers.get('x-late-signature')
  const rawBody = await request.text()

  const verified = verifyZernioWebhook({
    secret: process.env.ZERNIO_WEBHOOK_SECRET,
    signature,
    rawBody,
  })
  if (!verified.ok) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: verified.status })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const event = typeof payload.event === 'string' ? payload.event : ''
  const id = eventIdOf(payload, request.headers)
  if (!id) {
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error: insertError } = await supabase.from('zernio_webhook_events').insert({
    id,
    event,
    zernio_post_id: typeof payload.postId === 'string' ? payload.postId : null,
    account_id: accountIdOf(payload.account) || null,
    payload,
  })
  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true })
    }
    console.error('[zernio webhook] dedupe insert failed:', insertError.message)
    return NextResponse.json({ error: 'Could not record this event' }, { status: 500 })
  }

  void processZernioEvent(event, payload).catch((err) => {
    console.error('[zernio webhook] async process failed:', err)
  })

  return NextResponse.json({ success: true })
}

async function processZernioEvent(event: string, payload: Record<string, unknown>) {
  const supabase = createAdminClient()

  if (event === 'account.connected' || event === 'account.disconnected') {
    const profileId = typeof payload.profileId === 'string'
      ? payload.profileId
      : accountIdOf(asRecord(payload.profile))
    const accountId = typeof payload.accountId === 'string' ? payload.accountId : accountIdOf(payload.account)
    if (!profileId || !accountId) {
      console.error('[zernio webhook] account event missing profileId/accountId')
      return
    }

    const { data: brands } = await supabase
      .from('brands')
      .select('id, social_urls')
    const brand = (brands ?? []).find((row) => {
      const urls = (row.social_urls ?? {}) as Record<string, unknown>
      return urls.zernio_profile_id === profileId
    })
    if (!brand) {
      console.error('[zernio webhook] unknown profileId, dropped', profileId)
      return
    }

    if (event === 'account.disconnected') {
      await supabase
        .from('zernio_account_map')
        .update({ disconnected_at: new Date().toISOString() })
        .eq('brand_id', brand.id)
        .eq('account_id', accountId)
      return
    }

    await supabase.from('zernio_account_map').upsert({
      account_id: accountId,
      brand_id: brand.id,
      profile_id: profileId,
      platform: typeof payload.platform === 'string' ? payload.platform : '',
      username: typeof payload.username === 'string' ? payload.username : null,
      disconnected_at: null,
    }, { onConflict: 'account_id,brand_id' })
    return
  }

  if (POST_LIFECYCLE_EVENTS.has(event)) {
    await recordPostLifecycle(supabase, event, payload)
    return
  }

  if (event === 'review.new' || event === 'conversation.started') {
    await raiseEngagementTask(supabase, event, payload)
    return
  }

  if (event === 'post.published' || event === 'post.failed' || event === 'post.partial') {
    const post = asRecord(payload.post) ?? payload
    const externalId = typeof post._id === 'string' ? post._id : typeof post.id === 'string' ? post.id : ''
    if (!externalId) {
      console.error('[zernio webhook] post event missing id, dropped')
      return
    }

    const { data: run } = await supabase
      .from('publisher_runs')
      .select('id, scheduled_post_id, account_id, status')
      .eq('external_post_id', externalId)
      .maybeSingle()

    if (!run) {
      console.error('[zernio webhook] no matching publisher_run for', externalId)
      return
    }

    const failed = event === 'post.failed' || event === 'post.partial'
    await supabase
      .from('publisher_runs')
      .update({
        status: failed && event === 'post.failed' ? 'failed' : event === 'post.published' ? 'success' : run.status,
        external_permalink: typeof post.platformPostUrl === 'string' ? post.platformPostUrl : undefined,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id)

    // The same system event the fallback handler has always written. Without
    // it the activity thread on a post published through the main connection
    // shows comments and nothing else.
    if (run.scheduled_post_id) {
      await writeActivity(supabase, run.scheduled_post_id, {
        type: event === 'post.published' ? 'published' : event === 'post.failed' ? 'failed' : 'status_change',
        metadata: {
          ...(typeof post.platformPostUrl === 'string' ? { permalink: post.platformPostUrl } : {}),
          ...(event === 'post.partial' ? { partial: true } : {}),
        },
      })
    }
    return
  }

  if (event === 'message.received' || event === 'comment.received') {
    const account = asRecord(payload.account)
    const accountId = accountIdOf(account)
    if (!accountId) {
      console.error('[zernio webhook] inbox event unknown accountId, dropped')
      return
    }

    const { data: live } = await supabase
      .from('zernio_account_map')
      .select('brand_id, account_id')
      .eq('account_id', accountId)
      .is('disconnected_at', null)

    if (!live || live.length === 0) {
      console.error('[zernio webhook] inbox unknown accountId, dropped', accountId)
      return
    }
    if (live.length > 1) {
      console.error('[zernio webhook] two live map rows for one accountId, dropped', accountId)
      return
    }

    const brandId = live[0]!.brand_id
    const { data: brand } = await supabase
      .from('brands')
      .select('id, user_id')
      .eq('id', brandId)
      .maybeSingle()
    if (!brand) return

    const message = asRecord(payload.message)
    const conversation = asRecord(payload.conversation)
    const text = typeof message?.text === 'string' ? message.text : ''

    await supabase.from('tasks').insert({
      user_id: brand.user_id,
      brand_id: brand.id,
      title: event === 'comment.received' ? '1 new comment' : '1 new message',
      description: text ? `A customer wrote: "${text}"` : 'A customer sent a message.',
      context: {
        source: 'zernio_inbox',
        conversationId: conversation?.id ?? conversation?._id,
        accountId,
        platform: account?.platform,
      },
      status: 'backlog',
      priority: 'high',
    })
  }
}

/* ── System events on a post ───────────────────────────────────────────── */

type AdminClient = ReturnType<typeof createAdminClient>

/** Subscribed 2026-08-18. Each one maps onto a row the owner can read. */
const POST_LIFECYCLE_EVENTS = new Set([
  'post.scheduled',
  'post.cancelled',
  'post.platform.published',
  'post.platform.failed',
  'post.platform.deleted',
])

/**
 * `post_activity.type` is a CHECK constraint with eight values
 * (migration 033). An event that has no exact match becomes `status_change`
 * with the detail in `metadata` — inventing a ninth type would have the insert
 * rejected wholesale and the event lost without a word.
 */
const ACTIVITY_TYPE_BY_EVENT: Record<string, string> = {
  'post.scheduled': 'scheduled',
  'post.cancelled': 'status_change',
  'post.platform.published': 'published',
  'post.platform.failed': 'failed',
  'post.platform.deleted': 'status_change',
}

async function writeActivity(
  supabase: AdminClient,
  scheduledPostId: string,
  entry: { type: string; body?: string | null; metadata?: Record<string, unknown> },
) {
  // user_id is null: this is the system speaking, not a person. The comment
  // path always sets it.
  const { error } = await supabase.from('post_activity').insert({
    scheduled_post_id: scheduledPostId,
    user_id: null,
    type: entry.type,
    body: entry.body ?? null,
    metadata: entry.metadata ?? {},
  })
  if (error) console.error('[zernio webhook] could not record activity:', error.message)
}

/** Our row id for a publisher post id, via the run that sent it. */
async function scheduledPostIdFor(
  supabase: AdminClient,
  externalPostId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  // Stamped by createZernioPost on the way out, so the cheap answer first.
  const metadata = asRecord(payload.metadata) ?? asRecord(asRecord(payload.post)?.metadata)
  const stamped = metadata?.nrsScheduledPostId
  if (typeof stamped === 'string' && stamped.trim()) return stamped.trim()

  if (!externalPostId) return null
  const { data: run } = await supabase
    .from('publisher_runs')
    .select('scheduled_post_id')
    .eq('external_post_id', externalPostId)
    .maybeSingle()
  return run?.scheduled_post_id ?? null
}

async function recordPostLifecycle(
  supabase: AdminClient,
  event: string,
  payload: Record<string, unknown>,
) {
  const post = asRecord(payload.post) ?? payload
  const externalId = typeof post._id === 'string'
    ? post._id
    : typeof post.id === 'string'
      ? post.id
      : typeof payload.postId === 'string'
        ? payload.postId
        : ''

  const scheduledPostId = await scheduledPostIdFor(supabase, externalId, payload)
  if (!scheduledPostId) {
    // Not ours, or published before this app knew about it. Recorded in
    // zernio_webhook_events either way, so nothing is lost.
    console.error('[zernio webhook] no local post for', event, externalId)
    return
  }

  const platform = typeof payload.platform === 'string'
    ? payload.platform
    : typeof asRecord(payload.platformResult)?.platform === 'string'
      ? String(asRecord(payload.platformResult)?.platform)
      : 'social'

  await writeActivity(supabase, scheduledPostId, {
    type: ACTIVITY_TYPE_BY_EVENT[event] ?? 'status_change',
    metadata: {
      event,
      platform,
      ...(typeof payload.error === 'string' ? { error: payload.error } : {}),
      ...(typeof payload.platformPostUrl === 'string' ? { permalink: payload.platformPostUrl } : {}),
      // The post was published and is no longer on the platform. For a business
      // advertising regulated health services that is a fact somebody has to
      // see, not a status to quietly overwrite.
      ...(event === 'post.platform.deleted' ? { removed_from_platform: true } : {}),
      ...(event === 'post.cancelled' ? { cancelled: true } : {}),
    },
  })
}

/**
 * A new review or a first message becomes a task, the same way a comment does.
 *
 * Owner language only: no platform ids, no vendor names, no event strings.
 */
async function raiseEngagementTask(
  supabase: AdminClient,
  event: string,
  payload: Record<string, unknown>,
) {
  const account = asRecord(payload.account)
  const accountId = accountIdOf(payload.accountId) || accountIdOf(account)
  if (!accountId) {
    console.error('[zernio webhook] engagement event with no account, dropped')
    return
  }

  const { data: live } = await supabase
    .from('zernio_account_map')
    .select('brand_id')
    .eq('account_id', accountId)
    .is('disconnected_at', null)

  if (!live || live.length !== 1) {
    console.error('[zernio webhook] engagement event unmapped account, dropped', accountId)
    return
  }

  const { data: brand } = await supabase
    .from('brands')
    .select('id, user_id')
    .eq('id', live[0]!.brand_id)
    .maybeSingle()
  if (!brand) return

  const review = asRecord(payload.review)
  const rating = typeof review?.rating === 'number' ? review.rating : null
  const text = typeof review?.comment === 'string'
    ? review.comment
    : typeof asRecord(payload.message)?.text === 'string'
      ? String(asRecord(payload.message)?.text)
      : ''

  await supabase.from('tasks').insert({
    user_id: brand.user_id,
    brand_id: brand.id,
    title: event === 'review.new' ? '1 new review' : '1 new conversation',
    description: event === 'review.new'
      ? [rating ? `${rating} out of 5.` : null, text ? `They wrote: "${text}"` : null]
          .filter(Boolean)
          .join(' ') || 'Someone left a review.'
      : text
        ? `Someone started a conversation: "${text}"`
        : 'Someone started a conversation.',
    context: {
      source: 'zernio_inbox',
      accountId,
      platform: account?.platform,
      ...(review ? { reviewId: review.id ?? review._id } : {}),
      ...(asRecord(payload.conversation)
        ? { conversationId: asRecord(payload.conversation)?.id ?? asRecord(payload.conversation)?._id }
        : {}),
    },
    status: 'backlog',
    priority: 'high',
  })
}
