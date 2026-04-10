/**
 * Outbound user webhook dispatcher.
 *
 * Called from event sources inside NRS (post creation, scheduling, publish
 * success/failure, media upload, brand update) to fan out to whichever
 * third-party endpoints the user has registered for that event.
 *
 * Design notes:
 * - Uses the admin client because dispatch is fired by background code
 *   (cron, webhooks, server-side flows), not a user-authenticated request.
 *   RLS would otherwise block the read.
 * - Non-blocking by convention — call sites should `void fireUserWebhooks(...)`
 *   so a slow third-party endpoint never delays a user-facing response.
 * - Each delivery is logged into user_webhook_deliveries with success/failed
 *   status, HTTP status, and error message. The webhook row's
 *   last_delivery_at + last_delivery_status are updated so the index page
 *   can show health at a glance.
 * - HMAC-SHA256 signature is sent in `X-Signature` (hex digest, prefixed
 *   with `sha256=`). Receivers verify by recomputing the digest with the
 *   shared secret and comparing.
 *
 * NOT YET wired into event sources — Phase 8 only ships the dispatcher
 * and the management UI. A later integration pass will hook it into
 * syncDraftToMixpost, /api/scheduled-posts, /api/media/process, etc.
 */

import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { WebhookEvent } from './events'

interface FireUserWebhooksArgs {
  brandId: string
  event: WebhookEvent
  payload: Record<string, unknown>
}

interface UserWebhookRow {
  id: string
  url: string
  method: string | null
  secret: string | null
  events: string[] | null
}

const DELIVERY_TIMEOUT_MS = 10_000

/**
 * Fan out an event to every active user webhook for the given brand that
 * has subscribed to it. Resolves once all deliveries have been attempted
 * and logged. Never throws — failures are recorded against the delivery
 * row, not propagated to the caller.
 */
export async function fireUserWebhooks({
  brandId,
  event,
  payload,
}: FireUserWebhooksArgs): Promise<void> {
  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.warn('[user-webhooks] admin client unavailable:', err)
    return
  }

  const { data, error } = await supabase
    .from('user_webhooks')
    .select('id, url, method, secret, events')
    .eq('brand_id', brandId)
    .eq('active', true)
    .contains('events', [event])

  if (error) {
    console.warn('[user-webhooks] failed to load subscribers:', error.message)
    return
  }

  const subscribers = (data ?? []) as UserWebhookRow[]
  if (subscribers.length === 0) return

  const body = JSON.stringify({
    event,
    brand_id: brandId,
    delivered_at: new Date().toISOString(),
    data: payload,
  })

  await Promise.all(
    subscribers.map((webhook) => deliverOne(supabase, webhook, event, body))
  )
}

async function deliverOne(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  webhook: UserWebhookRow,
  event: WebhookEvent,
  body: string
): Promise<void> {
  const method = (webhook.method ?? 'POST').toUpperCase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'NotRealSmart-Webhooks/1.0',
    'X-NRS-Event': event,
    'X-NRS-Webhook-Id': webhook.id,
  }

  if (webhook.secret) {
    const signature = createHmac('sha256', webhook.secret).update(body).digest('hex')
    headers['X-Signature'] = `sha256=${signature}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)

  let httpStatus: number | null = null
  let responseBody: string | null = null
  let errorMessage: string | null = null
  let success = false

  try {
    const res = await fetch(webhook.url, {
      method,
      headers,
      body,
      signal: controller.signal,
    })
    httpStatus = res.status
    // Capture up to 8 KB of response — enough to debug without filling
    // the deliveries table with megabytes of HTML error pages.
    try {
      const text = await res.text()
      responseBody = text.slice(0, 8192)
    } catch {
      responseBody = null
    }
    success = res.ok
    if (!success) {
      errorMessage = `HTTP ${res.status}`
    }
  } catch (err) {
    success = false
    errorMessage =
      err instanceof Error
        ? err.name === 'AbortError'
          ? `Timeout after ${DELIVERY_TIMEOUT_MS}ms`
          : err.message
        : 'Unknown delivery error'
  } finally {
    clearTimeout(timer)
  }

  const status = success ? 'success' : 'failed'

  // Best-effort logging — if these writes fail we don't have anywhere
  // sensible to escalate, so just warn.
  try {
    await supabase.from('user_webhook_deliveries').insert({
      webhook_id: webhook.id,
      event,
      status,
      http_status: httpStatus,
      payload: JSON.parse(body),
      response: responseBody ? { body: responseBody } : null,
      error: errorMessage,
      attempt: 1,
    })
  } catch (err) {
    console.warn('[user-webhooks] failed to log delivery:', err)
  }

  try {
    await supabase
      .from('user_webhooks')
      .update({
        last_delivery_at: new Date().toISOString(),
        last_delivery_status: status,
      })
      .eq('id', webhook.id)
  } catch (err) {
    console.warn('[user-webhooks] failed to update webhook health:', err)
  }
}
