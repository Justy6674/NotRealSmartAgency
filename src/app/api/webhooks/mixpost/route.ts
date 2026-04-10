import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { parseNotificationPreferences } from '@/lib/notification-preferences'
import { buildPostPublishedEmail, buildPostFailedEmail } from '@/lib/emails/post-published'

/**
 * Mixpost Pro webhook receiver.
 *
 * Handles the full event catalogue emitted by Mixpost Pro's
 * TriggerWebhook action (verified against the Laravel source on
 * 2026-04-10 — see ~/Obsidian/Reference/nrs-mixpost-webhooks.md):
 *
 *  - post.created           draft/scheduled post created in Mixpost
 *  - post.updated           caption, hashtags, or media edited
 *  - post.scheduled         post moved to scheduled status
 *  - post.published         successfully published to social platforms
 *  - post.publishing_failed publishing failed (tokens, rate limits, etc.)
 *  - post.deleted           post deleted
 *  - account.added          social account newly connected to Mixpost
 *  - account.updated        account metadata refreshed (token rotation)
 *  - account.deleted        social account disconnected/token revoked
 *
 * Signature verification uses HMAC SHA-256 over the RAW request body
 * with the shared secret in MIXPOST_WEBHOOK_SECRET. Mixpost's header
 * name is `X-Signature` (not the old `x-mixpost-signature` used by the
 * previous implementation — that was wrong and every signature check
 * silently passed without validation).
 *
 * Previous bugs fixed in this version:
 *   1. Wrong header name (`x-mixpost-signature`)  → `x-signature`
 *   2. Plain string compare instead of HMAC       → crypto.timingSafeEqual
 *   3. Listening for `post.published.failed`      → `post.publishing_failed`
 *      which is Mixpost's actual event name. The old handler silently
 *      dropped every failure webhook since the integration shipped.
 */

export const runtime = 'nodejs'

type AdminClient = ReturnType<typeof createAdminClient>

// ── Signature verification ───────────────────────────────────────────────────

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.MIXPOST_WEBHOOK_SECRET
  if (!secret) {
    // No secret configured — allow the request through so nothing
    // breaks in dev, but log loudly so we notice in prod. Any prod
    // deploy should have MIXPOST_WEBHOOK_SECRET set via Vercel env.
    console.warn('[mixpost-webhook] MIXPOST_WEBHOOK_SECRET not set — skipping signature verification')
    return true
  }

  if (!header) return false

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  if (header.length !== expected.length) return false

  try {
    return crypto.timingSafeEqual(
      Buffer.from(header, 'utf8'),
      Buffer.from(expected, 'utf8'),
    )
  } catch {
    return false
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // CRITICAL: read the raw body text BEFORE parsing JSON. Re-serialising
  // via request.json() would produce different bytes and the HMAC check
  // would always fail.
  const rawBody = await request.text()

  if (!verifySignature(rawBody, request.headers.get('x-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  let body: { event?: string; data?: Record<string, unknown> }
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = body.event
  const eventData = (body.data ?? {}) as Record<string, unknown>

  if (!eventType) {
    return NextResponse.json({ error: 'Missing event field' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (eventType) {
      case 'post.published':
        await handlePublished(supabase, eventData)
        break
      case 'post.publishing_failed':
        await handlePublishingFailed(supabase, eventData)
        break
      case 'post.scheduled':
        await handleScheduled(supabase, eventData)
        break
      case 'post.updated':
        await handleUpdated(supabase, eventData)
        break
      case 'post.created':
        // No-op — we already know about posts we created. Only useful
        // if a post is created directly in Mixpost admin UI, which
        // Justin doesn't do. Log for observability.
        await logEvent(supabase, eventType, eventData)
        break
      case 'post.deleted':
        await handleDeleted(supabase, eventData)
        break
      case 'account.added':
      case 'account.updated':
      case 'account.deleted':
        await handleAccountEvent(supabase, eventType, eventData)
        break
      default:
        console.warn(`[mixpost-webhook] unknown event type: ${eventType}`)
        await logEvent(supabase, eventType, eventData)
    }
  } catch (err) {
    console.error(`[mixpost-webhook] handler error for ${eventType}:`, err)
    // Still return 200 so Mixpost doesn't retry indefinitely — we've
    // got what we needed and the error is logged.
  }

  return NextResponse.json({ received: true, event: eventType })
}

// ── Handlers ─────────────────────────────────────────────────────────────────

function extractMixpostPostId(data: Record<string, unknown>): string | null {
  const raw = data.post_id ?? data.id ?? (data.post as Record<string, unknown> | undefined)?.id
  if (raw == null) return null
  return String(raw)
}

async function handlePublished(supabase: AdminClient, data: Record<string, unknown>) {
  const mixpostPostId = extractMixpostPostId(data)
  if (!mixpostPostId) return

  await supabase
    .from('scheduled_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('external_post_id', mixpostPostId)

  await sendPublishNotification(supabase, mixpostPostId, 'published')
}

async function handlePublishingFailed(supabase: AdminClient, data: Record<string, unknown>) {
  const mixpostPostId = extractMixpostPostId(data)
  if (!mixpostPostId) return

  const errorReason =
    (data.reason as string) ?? (data.error as string) ?? (data.message as string) ?? 'Publishing failed'

  await supabase
    .from('scheduled_posts')
    .update({
      status: 'failed',
      error: errorReason,
    })
    .eq('external_post_id', mixpostPostId)

  await sendPublishNotification(supabase, mixpostPostId, 'failed', errorReason)
}

async function handleScheduled(supabase: AdminClient, data: Record<string, unknown>) {
  const mixpostPostId = extractMixpostPostId(data)
  if (!mixpostPostId) return

  // If the post was rescheduled inside Mixpost (e.g. Justin dragged it
  // on the Mixpost calendar), mirror the new scheduled_at into NRS so
  // the Studio calendar/Review tabs stay in sync.
  const newScheduledAt =
    (data.scheduled_at as string) ??
    (data.scheduledAt as string) ??
    ((data.post as Record<string, unknown> | undefined)?.scheduled_at as string | undefined)

  const update: Record<string, unknown> = { status: 'scheduled' }
  if (newScheduledAt) update.scheduled_at = new Date(newScheduledAt).toISOString()

  await supabase
    .from('scheduled_posts')
    .update(update)
    .eq('external_post_id', mixpostPostId)
}

async function handleUpdated(supabase: AdminClient, data: Record<string, unknown>) {
  const mixpostPostId = extractMixpostPostId(data)
  if (!mixpostPostId) return

  // When Justin edits the caption/hashtags inside the Mixpost iframe
  // modal, Mixpost fires post.updated. Pull the latest versions blob
  // out of the payload and sync the caption back into NRS so the
  // Review tab reflects the edit without a round-trip.
  const post = (data.post as Record<string, unknown> | undefined) ?? data
  const versions = post.versions as Array<Record<string, unknown>> | undefined
  const firstVersion = versions?.[0]
  const content = firstVersion?.content as Array<Record<string, unknown>> | undefined
  const body = content?.[0]?.body as string | undefined

  if (body) {
    await supabase
      .from('scheduled_posts')
      .update({ caption: body })
      .eq('external_post_id', mixpostPostId)
  }
}

async function handleDeleted(supabase: AdminClient, data: Record<string, unknown>) {
  const mixpostPostId = extractMixpostPostId(data)
  if (!mixpostPostId) return

  // Mark the NRS row as cancelled rather than deleting it — we keep
  // the audit trail. If Justin deletes from Mixpost, the draft should
  // stop appearing in Review but remain searchable.
  await supabase
    .from('scheduled_posts')
    .update({ status: 'cancelled' })
    .eq('external_post_id', mixpostPostId)
}

async function handleAccountEvent(
  supabase: AdminClient,
  eventType: string,
  data: Record<string, unknown>,
) {
  // Log to audit_log for observability. When account.deleted fires we
  // could also flag affected brands for a "reconnect your social
  // account" banner, but that belongs in a follow-up — for now the
  // Studio dashboard already shows connection status from Mixpost's
  // accounts API on page load.
  await logEvent(supabase, eventType, data)
}

async function logEvent(
  supabase: AdminClient,
  eventType: string,
  data: Record<string, unknown>,
) {
  // Append-only audit trail of every webhook received. Queryable via
  // `select * from audit_log where entity_type = 'mixpost_webhook'`.
  await supabase.from('audit_log').insert({
    action: 'mixpost_webhook',
    entity_type: 'mixpost_webhook',
    entity_id: extractMixpostPostId(data) ?? eventType,
    metadata: { event: eventType, data },
  })
}

// ── Notification emails (preserved from previous version) ───────────────────

async function sendPublishNotification(
  supabase: AdminClient,
  mixpostPostId: string,
  status: 'published' | 'failed',
  errorMessage?: string,
) {
  try {
    const { data: post } = await supabase
      .from('scheduled_posts')
      .select('user_id, platform, caption, brand_id, brands(name)')
      .eq('external_post_id', mixpostPostId)
      .single()

    if (!post?.user_id) return

    const { data: user } = await supabase
      .from('users')
      .select('email, work_context')
      .eq('id', post.user_id)
      .single()

    if (!user?.email) return

    const prefs = parseNotificationPreferences(user.work_context)
    if (status === 'published' && !prefs.notify_post_published) return
    if (status === 'failed' && !prefs.notify_post_failed) return

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return

    const resend = new Resend(apiKey)
    const brandsData = post.brands as { name: string } | { name: string }[] | null
    const brandName = Array.isArray(brandsData)
      ? brandsData[0]?.name ?? 'your brand'
      : brandsData?.name ?? 'your brand'
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@notrealsmart.com.au'

    const html =
      status === 'published'
        ? buildPostPublishedEmail(post.platform, post.caption ?? '', brandName)
        : buildPostFailedEmail(post.platform, errorMessage ?? 'Unknown error', brandName)

    const subject =
      status === 'published'
        ? `Your ${post.platform} post for ${brandName} is live!`
        : `Publishing failed: ${post.platform} post for ${brandName}`

    await resend.emails.send({
      from: `NRS Agency <${fromEmail}>`,
      to: user.email,
      subject,
      html,
    })
  } catch (err) {
    console.error('Failed to send publish notification:', err)
  }
}
