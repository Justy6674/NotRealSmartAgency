/**
 * Publisher dispatcher — routes publish requests to native or Mixpost.
 *
 * Per-platform feature flags:
 *   USE_NATIVE_PUBLISHER_LINKEDIN=true  → native LinkedIn publisher
 *   USE_NATIVE_PUBLISHER_FACEBOOK=true  → native Meta publisher (future)
 *   (anything else or undefined)        → Mixpost fallback
 *
 * Every attempt is logged to the publisher_runs table for audit.
 */

import { checkPublishAllowed } from '@/lib/agents/publish-gate'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createMixpostPost,
  fetchMixpostAccounts,
  resolveAccountIdsForPlatform,
  uploadMediaFromUrl,
  type MixpostVersion,
} from '@/lib/mixpost/client'
import { getToken, refreshTokenIfNeeded } from './token-store'
import { canPublish, recordPublish } from './rate-limiter'
import { validateMedia } from './media-validator'
import { enqueueRetry } from './retry-queue'
import type {
  PublishRequest,
  PublishResult,
  PublisherBackend,
  PublisherPlatform,
} from './types'

// Lazy-load native publishers to avoid importing platform-specific
// code when only Mixpost is used.
const NATIVE_PUBLISHERS: Partial<
  Record<PublisherPlatform, () => Promise<{ default: import('./types').Publisher }>>
> = {
  linkedin: () => import('./linkedin') as never,
}

/**
 * Check if native publishing is enabled for a platform via env var.
 */
function isNativeEnabled(platform: PublisherPlatform): boolean {
  const envKey = `USE_NATIVE_PUBLISHER_${platform.toUpperCase()}`
  return process.env[envKey] === 'true'
}

/**
 * Log a publisher run to the database.
 */
async function logRun(params: {
  scheduledPostId: string
  platform: string
  publisher: PublisherBackend
  status: string
  attempt: number
  requestPayload?: unknown
  responsePayload?: unknown
  externalPostId?: string
  externalPermalink?: string
  error?: string
  durationMs?: number
}): Promise<string | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('publisher_runs')
    .insert({
      scheduled_post_id: params.scheduledPostId,
      platform: params.platform,
      publisher: params.publisher,
      status: params.status,
      attempt: params.attempt,
      request_payload: params.requestPayload ?? null,
      response_payload: params.responsePayload ?? null,
      external_post_id: params.externalPostId ?? null,
      external_permalink: params.externalPermalink ?? null,
      error: params.error ?? null,
      duration_ms: params.durationMs ?? null,
      finished_at: params.status !== 'running' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[dispatcher] Failed to log run:', error.message)
    return null
  }

  return data?.id ?? null
}

/**
 * Publish a post via native API or Mixpost fallback.
 */
export async function publishToPlatform(
  req: PublishRequest,
  attempt = 1,
): Promise<PublishResult> {
  const start = Date.now()
  const useNative = isNativeEnabled(req.platform)
  const backend: PublisherBackend = useNative ? 'native' : 'mixpost'

  // Regulatory review first — before rate limits, before media validation, and
  // before any platform call. This path had no compliance check at all, so
  // enabling direct publishing would have removed the only working AHPRA/TGA
  // gate rather than adding one. It runs on the first attempt only; a retry is
  // re-sending content that already passed.
  if (attempt === 1) {
    const admin = createAdminClient()
    const { data: brand } = await admin
      .from('brands')
      .select('name, slug, compliance_flags, brand_dna_constraints')
      .eq('id', req.brand_id)
      .maybeSingle()

    const gate = await checkPublishAllowed({
      content: [req.caption, ...(req.hashtags ?? [])].join(' ').trim(),
      complianceFlags: brand?.compliance_flags as never,
      brandDNA: brand?.brand_dna_constraints as never,
      brandSlug: brand?.slug as string | null | undefined,
      label: `${brand?.name ?? req.brand_id} → ${req.platform}`,
    })

    if (!gate.allowed) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        publisher: backend,
        status: 'failed',
        attempt,
        error: gate.reason ?? 'Blocked by the regulatory review',
        durationMs: Date.now() - start,
      })
      // Deliberately not queued for retry: a compliance block is a decision
      // about the content, and re-sending the same words will block again.
      return { ok: false, publisher: backend, error: gate.reason ?? 'Blocked by the regulatory review' }
    }
  }

  // Rate-limit check
  if (!canPublish(req.platform, req.brand_id)) {
    const runId = await logRun({
      scheduledPostId: req.scheduled_post_id,
      platform: req.platform,
      publisher: backend,
      status: 'rate_limited',
      attempt,
      error: 'Rate limit exceeded',
      durationMs: Date.now() - start,
    })

    if (runId) {
      await enqueueRetry({
        runId,
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        error: 'Rate limit exceeded',
        attempt,
      })
    }

    return {
      ok: false,
      publisher: backend,
      error: 'Rate limit exceeded — retrying later.',
    }
  }

  // Media validation
  if (req.media.length > 0) {
    const validation = validateMedia(req.platform, req.media)
    if (!validation.ok) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        publisher: backend,
        status: 'failed',
        attempt,
        error: validation.errors.join(' '),
        durationMs: Date.now() - start,
      })

      return {
        ok: false,
        publisher: backend,
        error: validation.errors.join(' '),
      }
    }
  }

  // ── Native path ───────────────────────────────────────────────────────
  if (useNative && NATIVE_PUBLISHERS[req.platform]) {
    try {
      const publisherModule = await NATIVE_PUBLISHERS[req.platform]!()
      const publisher = publisherModule.default

      // Validate via publisher
      const preCheck = publisher.validate(req)
      if (!preCheck.ok) {
        await logRun({
          scheduledPostId: req.scheduled_post_id,
          platform: req.platform,
          publisher: 'native',
          status: 'failed',
          attempt,
          error: preCheck.errors.join(' '),
          durationMs: Date.now() - start,
        })
        return { ok: false, publisher: 'native', error: preCheck.errors.join(' ') }
      }

      // Get and refresh token
      let token = await getToken(req.brand_id, req.platform)
      if (!token) {
        await logRun({
          scheduledPostId: req.scheduled_post_id,
          platform: req.platform,
          publisher: 'native',
          status: 'failed',
          attempt,
          error: `No active OAuth token for ${req.platform}`,
          durationMs: Date.now() - start,
        })
        return {
          ok: false,
          publisher: 'native',
          error: `No active OAuth token for ${req.platform}. Connect the account first.`,
        }
      }

      token = await refreshTokenIfNeeded(token)
      if (!token) {
        await logRun({
          scheduledPostId: req.scheduled_post_id,
          platform: req.platform,
          publisher: 'native',
          status: 'failed',
          attempt,
          error: 'Token refresh failed',
          durationMs: Date.now() - start,
        })
        return {
          ok: false,
          publisher: 'native',
          error: 'OAuth token expired and refresh failed. Re-connect the account.',
        }
      }

      // Publish
      const result = await publisher.publish(req, token)
      const durationMs = Date.now() - start

      const runId = await logRun({
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        publisher: 'native',
        status: result.ok ? 'success' : 'failed',
        attempt,
        requestPayload: { caption: req.caption, mediaCount: req.media.length },
        responsePayload: result,
        externalPostId: result.external_post_id,
        externalPermalink: result.external_permalink,
        error: result.error,
        durationMs,
      })

      if (result.ok) {
        recordPublish(req.platform, req.brand_id)
      } else if (runId) {
        await enqueueRetry({
          runId,
          scheduledPostId: req.scheduled_post_id,
          platform: req.platform,
          error: result.error ?? 'Unknown error',
          attempt,
        })
      }

      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      const durationMs = Date.now() - start

      const runId = await logRun({
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        publisher: 'native',
        status: 'failed',
        attempt,
        error,
        durationMs,
      })

      if (runId) {
        await enqueueRetry({
          runId,
          scheduledPostId: req.scheduled_post_id,
          platform: req.platform,
          error,
          attempt,
        })
      }

      return { ok: false, publisher: 'native', error }
    }
  }

  // ── Mixpost fallback ──────────────────────────────────────────────────
  try {
    const accounts = await fetchMixpostAccounts()
    if (!accounts || accounts.length === 0) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        publisher: 'mixpost',
        status: 'failed',
        attempt,
        error: 'No Mixpost accounts available',
        durationMs: Date.now() - start,
      })
      return {
        ok: false,
        publisher: 'mixpost',
        error: 'No Mixpost accounts connected.',
      }
    }

    const accountIds = resolveAccountIdsForPlatform(req.platform, accounts)
    if (accountIds.length === 0) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        publisher: 'mixpost',
        status: 'failed',
        attempt,
        error: `No Mixpost account for ${req.platform}`,
        durationMs: Date.now() - start,
      })
      return {
        ok: false,
        publisher: 'mixpost',
        error: `No Mixpost account connected for ${req.platform}.`,
      }
    }

    // Upload media to Mixpost
    const mediaIds: number[] = []
    for (const m of req.media) {
      const uploaded = await uploadMediaFromUrl(m.url, m.alt_text)
      if (uploaded) mediaIds.push(uploaded.id)
    }

    const fullCaption = req.hashtags?.length
      ? `${req.caption}\n\n${req.hashtags.join(' ')}`
      : req.caption

    const version: MixpostVersion = {
      account_id: accountIds[0]!,
      is_original: true,
      content: [{ body: fullCaption, media: mediaIds, url: null, video_thumbs: [] }],
    }

    const result = await createMixpostPost({
      accounts: accountIds,
      versions: [version],
      schedule_now: true,
    })

    const durationMs = Date.now() - start

    if (result) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        publisher: 'mixpost',
        status: 'success',
        attempt,
        responsePayload: result,
        externalPostId: result.uuid,
        durationMs,
      })
      recordPublish(req.platform, req.brand_id)
      return {
        ok: true,
        publisher: 'mixpost',
        external_post_id: result.uuid,
      }
    }

    const runId = await logRun({
      scheduledPostId: req.scheduled_post_id,
      platform: req.platform,
      publisher: 'mixpost',
      status: 'failed',
      attempt,
      error: 'Mixpost createPost returned null',
      durationMs,
    })

    if (runId) {
      await enqueueRetry({
        runId,
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        error: 'Mixpost createPost returned null',
        attempt,
      })
    }

    return {
      ok: false,
      publisher: 'mixpost',
      error: 'Mixpost publishing failed.',
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - start

    const runId = await logRun({
      scheduledPostId: req.scheduled_post_id,
      platform: req.platform,
      publisher: 'mixpost',
      status: 'failed',
      attempt,
      error,
      durationMs,
    })

    if (runId) {
      await enqueueRetry({
        runId,
        scheduledPostId: req.scheduled_post_id,
        platform: req.platform,
        error,
        attempt,
      })
    }

    return { ok: false, publisher: 'mixpost', error }
  }
}
