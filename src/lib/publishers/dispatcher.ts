/**
 * Publisher dispatcher — the one door to a live account.
 *
 * Backends, in the order they are considered:
 *   Zernio    → the brand has a zernio_profile_id and a Zernio account for the
 *               platform (subscribers)
 *   native    → USE_NATIVE_PUBLISHER_{PLATFORM}=true
 *   Mixpost   → self-hosted fallback, and what Justin's own brands stay on
 *
 * Every attempt is logged to the publisher_runs table for audit.
 */

import { checkPublishAllowed } from '@/lib/agents/publish-gate'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import {
  createMixpostPost,
  fetchMixpostAccounts,
  resolveAccountIdsForPlatform,
  uploadMediaFromUrl,
  type MixpostAccount,
  type MixpostVersion,
} from '@/lib/mixpost/client'
import { buildPlatformOptions } from '@/lib/mixpost/sync-draft'
import {
  createZernioPost,
  fetchZernioAccounts,
  type ZernioAccount,
} from '@/lib/zernio/client'
import {
  OWNER_ACCOUNT_MISSING,
  OWNER_NO_TICK,
  OWNER_POSTING_PAUSED,
  publisherTransportOf,
  zernioProfileIdFromSocialUrls,
} from './transport'
import {
  emailJustinBillingPaused,
  isBillingPausedError,
  pauseLinkedBrandPosting,
} from './billing-pause'
import { getToken, refreshTokenIfNeeded } from './token-store'
import { canPublish, recordPublish } from './rate-limiter'
import { validateMedia } from './media-validator'
import { enqueueRetry } from './retry-queue'
import type {
  PublishRequest,
  PublishResult,
  PublisherBackend,
  PublisherPlatform,
  PublisherSelection,
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
 * Which publisher this brand's post goes to. The only place that decides.
 *
 * THE FAULT: the choice lived in two places that disagreed. The 5-minute cron
 * preferred Zernio whenever the brand had a Zernio account for the platform,
 * while /api/scheduled-posts/publish-now had no Zernio code in it at all — no
 * import, no key read — and always went to Mixpost. Those are two separate
 * OAuth connections to two separate services, and nothing in this codebase
 * asserts they point at the same Facebook Page, Instagram profile or LinkedIn
 * organisation. The Review panel puts both buttons on the same row: "Schedule"
 * handed it to the cron and it landed on the Zernio account, "Publish now"
 * handed it to the other route and it landed on the Mixpost one. A brand
 * connected to Zernio but not Mixpost published cleanly on one button and was
 * written to the row as failed on the other — and once failed, the cron would
 * not pick it up again, because it only selects status='scheduled'.
 *
 * The rule below is the cron's rule, unchanged, because the cron is the path
 * that has actually been publishing: a brand with a `zernio_profile_id` and a
 * Zernio account whose platform string matches exactly goes to Zernio;
 * everything else falls through to the native/Mixpost behaviour that was
 * already here. Zernio for subscribers, self-hosted Mixpost stays live as the
 * fallback for Justin's own brands.
 *
 * Deliberately cannot throw. A selector that threw would take the publish down
 * with it, and the safe direction on an unanswered Zernio call is the fallback
 * that already works — not a dropped post.
 */
export async function selectPublisherBackend(
  brand: { id?: string; social_urls?: Record<string, unknown> | null } | null | undefined,
  platform: PublisherPlatform,
  /**
   * The exact account this call may touch. Required. Matching on platform
   * alone posts two Instagram ticks to Instagram 1.
   */
  accountId: string,
  /**
   * The team's Zernio accounts, already listed by the caller. Pass the
   * UNFILTERED list — the cron lists it once per tick and reuses it across
   * every due post rather than making one API call per post. Omit it and this
   * fetches the list itself. Isolation is still applied here after
   * normaliseAccount (fetchZernioAccounts already filters).
   */
  zernioAccounts?: readonly ZernioAccount[],
): Promise<PublisherSelection> {
  const fallback: PublisherSelection = isNativeEnabled(platform)
    ? { backend: 'native' }
    : { backend: 'mixpost' }

  const wanted = accountId.trim()
  if (wanted === '') {
    return { backend: 'refused', reason: OWNER_NO_TICK }
  }

  const socialUrls = brand?.social_urls ?? null
  const transport = publisherTransportOf(socialUrls)
  const profileId = zernioProfileIdFromSocialUrls(socialUrls)

  // Unlinked, or Justin flipped the backup toggle: Mixpost/native ids only.
  // Empty Zernio map is irrelevant. Never look the Mixpost id up on the map.
  if (transport === 'mixpost' || !profileId) {
    return fallback
  }

  try {
    if (!process.env.ZERNIO_API_KEY) {
      return { backend: 'refused', reason: OWNER_ACCOUNT_MISSING }
    }

    const accounts = zernioAccounts ?? (await fetchZernioAccounts(profileId))
    const match = accounts.find(
      (a) => a.id === wanted && a.profileId === profileId && a.platform === platform,
    )
    if (!match) {
      // Linked + no matching Zernio account → Didn’t send. No Mixpost hop.
      return { backend: 'refused', reason: OWNER_ACCOUNT_MISSING }
    }

    return { backend: 'zernio', zernioAccountId: match.id, zernioProfileId: profileId }
  } catch (err) {
    console.error(
      '[dispatcher] Zernio selection failed:',
      err instanceof Error ? err.message : String(err),
    )
    return { backend: 'refused', reason: OWNER_ACCOUNT_MISSING }
  }
}

/**
 * The text that actually reaches the account, built once for every backend.
 *
 * This file joined hashtags with no '#' at all — `weightloss`, not
 * `#weightloss` — while both live publishing routes prefix them, and none of
 * the three appended the brand's sign-off consistently. Same stored row,
 * visibly different post, decided by which code path sent it. A tag that
 * already carries its own '#' is not given a second one, because the tags
 * column has both shapes in it.
 */
function buildCaption(req: PublishRequest): string {
  const tags = (req.hashtags ?? [])
    .map((h) => h.trim())
    .filter((h) => h !== '')
    .map((h) => (h.startsWith('#') ? h : `#${h}`))

  let caption = req.caption
  if (tags.length > 0) caption += `\n\n${tags.join(' ')}`
  if (req.signature) caption += req.signature
  return caption
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/**
 * What Zernio actually said, rather than the fact that it answered.
 *
 * With publishNow the create response is terminal: it carries the per-platform
 * status, the public permalink and, on failure, errorMessage. The cron read
 * `result._id` off it and nothing else, so a post that came back `failed` was
 * stored with an external id and marked `publishing` — indistinguishable from
 * one that went live, and nothing downstream ever corrected it, because the
 * Zernio webhook route handles only inbox events and the in-flight sweep asks
 * MIXPOST about the id. Relay the status honestly; pending is not done.
 *
 * A status that is neither published nor failed is NOT reported as a failure.
 * Calling an in-flight post failed is how seven posts once sat live on real
 * accounts while NRS recorded errors against them, and here it would be worse:
 * a failure enqueues a retry, and the retry would publish the post a second
 * time. It is reported as dispatched-but-unconfirmed instead.
 */
function readZernioOutcome(post: unknown): {
  ok: boolean
  confirmed: boolean
  externalPostId?: string
  externalPermalink?: string
  error?: string
} {
  const record = (post ?? null) as Record<string, unknown> | null
  if (!record) {
    return { ok: false, confirmed: false, error: 'Zernio returned nothing for this send.' }
  }

  const externalPostId = nonEmptyString(record._id) ?? nonEmptyString(record.id)
  const postStatus = nonEmptyString(record.status)
  const targets = Array.isArray(record.platforms)
    ? (record.platforms as Record<string, unknown>[])
    : []

  const failed = targets.find((t) => nonEmptyString(t.status) === 'failed')
  if (failed || postStatus === 'failed' || postStatus === 'partial') {
    const detail = nonEmptyString(failed?.errorMessage) ?? 'no reason given'
    return {
      ok: false,
      confirmed: false,
      ...(externalPostId ? { externalPostId } : {}),
      error: `Zernio did not publish this post: ${detail}`,
    }
  }

  const published = targets.find((t) => nonEmptyString(t.status) === 'published')
  if (published || postStatus === 'published') {
    return {
      ok: true,
      confirmed: true,
      ...(externalPostId ? { externalPostId } : {}),
      ...(nonEmptyString(published?.platformPostUrl)
        ? { externalPermalink: nonEmptyString(published?.platformPostUrl)! }
        : {}),
    }
  }

  return { ok: true, confirmed: false, ...(externalPostId ? { externalPostId } : {}) }
}

/**
 * Log a publisher run to the database.
 */
async function logRun(params: {
  scheduledPostId: string
  brandId: string
  accountId: string
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
  idempotencyKey?: string
}): Promise<string | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('publisher_runs')
    .insert({
      scheduled_post_id: params.scheduledPostId,
      brand_id: params.brandId,
      account_id: params.accountId,
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
      idempotency_key: params.idempotencyKey ?? null,
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
 * Publish a post via Zernio, a native API, or the Mixpost fallback.
 */
export async function publishToPlatform(
  req: PublishRequest,
  attempt = 1,
  options?: {
    /**
     * The team's Zernio accounts, listed once by the caller. Handed straight to
     * selectPublisherBackend. Without it every post in a cron batch would list
     * the accounts again over the network.
     */
    zernioAccounts?: readonly ZernioAccount[]
    /**
     * The UNFILTERED workspace Mixpost list, listed once by the caller.
     *
     * A twenty-post bulk publish otherwise makes twenty account listings. This
     * is a network saving and NOTHING else: the whole workspace is still handed
     * to mapAccountsToBrandsRaw below, before the platform filter, exactly as
     * if it had been fetched here. Narrowing this list on the way in would move
     * the project scoping out of the one place that is tested for it — see
     * 'a publish is scoped to the project that asked for it' in
     * src/lib/agents/regulatory-invariants.test.ts.
     */
    mixpostAccounts?: readonly MixpostAccount[]
  },
): Promise<PublishResult> {
  const start = Date.now()

  // One read of the brand, shared by the selector, the gate AND the Mixpost
  // account mapping. It sits outside the attempt === 1 block because a retry
  // still has to know which publisher this brand uses — and because reading the
  // same brand twice in one call is how the two answers get a chance to differ.
  // The Mixpost branch used to re-read it for `id, name, slug, social_urls`,
  // which on a twenty-post batch was forty brand reads for twenty publishes.
  const admin = createAdminClient()
  const { data: brand } = await admin
    .from('brands')
    .select('id, name, slug, social_urls, compliance_flags, brand_dna_constraints')
    .eq('id', req.brand_id)
    .maybeSingle()

  if (!req.account_id?.trim()) {
    return {
      ok: false,
      publisher: 'zernio',
      retryable: false,
      error: OWNER_NO_TICK,
    }
  }

  const selection = await selectPublisherBackend(
    brand as { id?: string; social_urls?: Record<string, unknown> | null } | null,
    req.platform,
    req.account_id,
    options?.zernioAccounts,
  )

  if (selection.backend === 'refused') {
    await logRun({
      scheduledPostId: req.scheduled_post_id,
      brandId: req.brand_id,
      accountId: req.account_id,
      platform: req.platform,
      publisher: 'zernio',
      status: 'failed',
      attempt,
      error: selection.reason,
      durationMs: Date.now() - start,
      idempotencyKey: req.idempotency_key,
    })
    return {
      ok: false,
      publisher: 'zernio',
      retryable: false,
      error: selection.reason,
    }
  }

  const backend: PublisherBackend = selection.backend
  const useNative = selection.backend === 'native'

  // Regulatory review first — before rate limits, before media validation, and
  // before any platform call, on every backend. This path had no compliance
  // check at all, so enabling direct publishing would have removed the only
  // working AHPRA/TGA gate rather than adding one. It runs on the first attempt
  // only; a retry is re-sending content that already passed.
  if (attempt === 1) {
    const gate = await checkPublishAllowed({
      // The exact words that will be sent, signature included — not a
      // reconstruction of them. A review of something adjacent to the post is
      // not a review of the post.
      content: buildCaption(req).trim(),
      complianceFlags: brand?.compliance_flags as never,
      brandDNA: brand?.brand_dna_constraints as never,
      brandSlug: brand?.slug as string | null | undefined,
      label: `${brand?.name ?? req.brand_id} → ${req.platform}`,
    })

    if (!gate.allowed) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
        platform: req.platform,
        publisher: backend,
        status: 'failed',
        attempt,
        error: gate.reason ?? 'Blocked by the regulatory review',
        durationMs: Date.now() - start,
      })
      // Deliberately not queued for retry: a compliance block is a decision
      // about the content, and re-sending the same words will block again.
      return {
        ok: false,
        publisher: backend,
        retryable: false,
        error: gate.reason ?? 'Blocked by the regulatory review',
      }
    }
  }

  // Rate-limit check
  if (!canPublish(req.platform, req.brand_id)) {
    const runId = await logRun({
      scheduledPostId: req.scheduled_post_id,
      brandId: req.brand_id,
      accountId: req.account_id,
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
        brandId: req.brand_id,
        accountId: req.account_id,
        platform: req.platform,
        error: 'Rate limit exceeded',
        attempt,
      })
    }

    return {
      ok: false,
      publisher: backend,
      // The content was never offered to the platform, so the row stays live.
      retryable: true,
      error: 'Rate limit exceeded — retrying later.',
    }
  }

  // Media validation
  if (req.media.length > 0) {
    const validation = validateMedia(req.platform, req.media)
    if (!validation.ok) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
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
        // A file that is too long or too large for the platform is still too
        // long on the next tick. Requeueing it would loop until the sweep gave
        // up, and the owner would be told nothing for twenty minutes.
        retryable: false,
        error: validation.errors.join(' '),
      }
    }
  }

  // ── Zernio path ───────────────────────────────────────────────────────
  if (selection.backend === 'zernio') {
    try {
      // One call, one platform, one caption. Zernio's platforms[].customContent
      // exists for the case where a single call fans out to several targets and
      // each needs its own text — the documented cause of Bluesky's 300-char and
      // X's 280-char failures. A PublishRequest carries exactly one platform, so
      // there is nothing here to override, and inventing a fan-out to use the
      // field would create the very problem the field solves.
      const result = await createZernioPost({
        content: buildCaption(req),
        accounts: [{ platform: req.platform, accountId: req.account_id }],
        requestId: req.idempotency_key,
        // Public URLs, not an upload: Zernio fetches them, and its docs state it
        // auto-proxies Supabase storage URLs, which is where this app's media
        // lives. Note createZernioPost types each item by file extension alone,
        // so a signed Supabase URL ending `?token=…` is typed as an image even
        // when it is a video, and alt text is dropped — both belong to
        // src/lib/zernio/client.ts, not to this file.
        mediaUrls: req.media.map((m) => m.url),
        publishNow: true,
      })

      const outcome = readZernioOutcome(result)
      const durationMs = Date.now() - start

      // KNOWN GAP, recorded rather than papered over: publisher_runs still
      // carries `check (publisher in ('native','mixpost'))` from migration 034.
      // Until that is widened these inserts are rejected, logRun returns null,
      // and the retry below never enqueues because it needs the run id. The
      // publish is unaffected; the audit row is not written. Widening a live
      // constraint is not this file's call to make.
      const runId = await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
        platform: req.platform,
        publisher: 'zernio',
        status: outcome.ok ? 'success' : 'failed',
        attempt,
        requestPayload: { caption: buildCaption(req), mediaCount: req.media.length },
        responsePayload: result,
        externalPostId: outcome.externalPostId,
        externalPermalink: outcome.externalPermalink,
        error: outcome.error,
        durationMs,
      })

      if (outcome.ok) {
        recordPublish(req.platform, req.brand_id)
        return {
          ok: true,
          publisher: 'zernio',
          confirmed: outcome.confirmed,
          ...(outcome.externalPostId ? { external_post_id: outcome.externalPostId } : {}),
          ...(outcome.externalPermalink ? { external_permalink: outcome.externalPermalink } : {}),
        }
      }

      if (runId) {
        await enqueueRetry({
          runId,
          scheduledPostId: req.scheduled_post_id,
          platform: req.platform,
          error: outcome.error ?? 'Zernio publishing failed',
          attempt,
        })
      }

      return {
        ok: false,
        publisher: 'zernio',
        confirmed: false,
        // Zernio answered and said no. That is a per-platform failure from the
        // network's side, not a decision about the words — the review already
        // passed — so it is worth another attempt.
        retryable: true,
        ...(outcome.externalPostId ? { external_post_id: outcome.externalPostId } : {}),
        error: outcome.error ?? 'Zernio publishing failed.',
      }
    } catch (err) {
      const durationMs = Date.now() - start

      if (isBillingPausedError(err)) {
        await pauseLinkedBrandPosting()
        await emailJustinBillingPaused()
        await logRun({
          scheduledPostId: req.scheduled_post_id,
          brandId: req.brand_id,
          accountId: req.account_id,
          platform: req.platform,
          publisher: 'zernio',
          status: 'failed',
          attempt,
          error: OWNER_POSTING_PAUSED,
          durationMs,
        })
        return {
          ok: false,
          publisher: 'zernio',
          confirmed: false,
          retryable: false,
          error: OWNER_POSTING_PAUSED,
        }
      }

      const error = OWNER_ACCOUNT_MISSING
      console.error('[dispatcher] publisher call failed:', err instanceof Error ? err.message : String(err))

      const runId = await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
        platform: req.platform,
        publisher: 'zernio',
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

      return { ok: false, publisher: 'zernio', confirmed: false, retryable: true, error }
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
          brandId: req.brand_id,
          accountId: req.account_id,
          platform: req.platform,
          publisher: 'native',
          status: 'failed',
          attempt,
          error: preCheck.errors.join(' '),
          durationMs: Date.now() - start,
        })
        return {
          ok: false,
          publisher: 'native',
          retryable: false,
          error: preCheck.errors.join(' '),
        }
      }

      // Get and refresh token
      let token = await getToken(req.brand_id, req.platform)
      if (!token) {
        await logRun({
          scheduledPostId: req.scheduled_post_id,
          brandId: req.brand_id,
          accountId: req.account_id,
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
          // Nobody has connected the account. Waiting does not connect it.
          retryable: false,
          error: `No active OAuth token for ${req.platform}. Connect the account first.`,
        }
      }

      token = await refreshTokenIfNeeded(token)
      if (!token) {
        await logRun({
          scheduledPostId: req.scheduled_post_id,
          brandId: req.brand_id,
          accountId: req.account_id,
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
          // The connection has lapsed and only the owner can restore it.
          retryable: false,
          error: 'OAuth token expired and refresh failed. Re-connect the account.',
        }
      }

      // Publish
      const result = await publisher.publish(req, token)
      const durationMs = Date.now() - start

      const runId = await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
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

      // The publisher's own verdict, with the requeue hint defaulted only when
      // it did not state one. A native publisher that knows the send was
      // refused on its merits can say `retryable: false` and be believed; the
      // enqueueRetry above already treats an unqualified failure as worth
      // another attempt, so the default matches what this path already does.
      return result.ok ? result : { ...result, retryable: result.retryable ?? true }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      const durationMs = Date.now() - start

      const runId = await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
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

      return { ok: false, publisher: 'native', retryable: true, error }
    }
  }

  // ── Mixpost fallback ──────────────────────────────────────────────────
  try {
    // A list the caller already has is used as given — including an empty one.
    // `??` and not `||` on purpose: an explicitly passed [] means the caller
    // has already looked and found nothing, and fetching a second opinion here
    // is how a batch ends up disagreeing with itself halfway through.
    const accounts = options?.mixpostAccounts ?? (await fetchMixpostAccounts())
    if (!accounts || accounts.length === 0) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
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
        // Mixpost was not reached, or answered with nothing. Either way the
        // content was never offered to a platform, so the row is still live.
        retryable: true,
        error: 'No Mixpost accounts connected.',
      }
    }

    /*
     * Narrow to THIS project before narrowing to the platform.
     *
     * `fetchMixpostAccounts()` returns the whole workspace — measured on
     * 2026-08-17, nineteen accounts across six projects. Filtering that by
     * platform alone resolves one Instagram post to every Instagram account
     * connected, so a Downscale weight-loss claim reviewed against Downscale's
     * AHPRA and TGA flags would also publish to Scent Sell, Underground Parfums,
     * DoToday, Endorse Me and TeleScribe — none of which carry those flags.
     *
     * The gate above would pass and the post would still be broadcast, which
     * does not merely bypass the review, it makes it misleading: content is
     * cleared for one regime and published under five others.
     *
     * Ordering matters. Filtering by platform first still filters the whole
     * workspace, so the project narrowing has to come first. Every other caller
     * of Mixpost already does this — publish-now, monitor-alerts, analytics and
     * the performance learner all route through mapAccountsToBrandsRaw, which
     * also honours the confirmed `social_urls.mixpost_account_ids` overrides.
     * This was the one publishing path that skipped it.
     */
    // Mapping needs the project's name, slug and its confirmed
    // `social_urls.mixpost_account_ids` overrides. Without the row there is
    // nothing to narrow by, and publishing to the unnarrowed workspace is the
    // fault being removed — so this fails closed rather than falling back.
    //
    // It is the SAME brand row the gate above was given, not a second read of
    // it. Two reads is two chances for the review and the destination to be
    // decided from different data.
    const brandAccounts = brand
      ? mapAccountsToBrandsRaw(
          // A copy, because the caller's batch list is shared across every post
          // in the tick and mapAccountsToBrandsRaw takes a mutable array.
          [...accounts],
          [
            {
              id: brand.id as string,
              name: brand.name as string,
              slug: brand.slug as string,
              social_urls: (brand.social_urls as Record<string, string>) ?? {},
            },
          ],
        ).get(req.brand_id) ?? []
      : []

    if (brandAccounts.length === 0) {
      // Fail closed. Publishing to every account because this project matched
      // none is the exact failure being removed.
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
        platform: req.platform,
        publisher: 'mixpost',
        status: 'failed',
        attempt,
        error: 'No Mixpost account is mapped to this project',
        durationMs: Date.now() - start,
      })
      return {
        ok: false,
        publisher: 'mixpost',
        // Not a transport failure. Nothing is connected, and the next tick will
        // find nothing connected too — requeueing would hide the one thing the
        // owner has to do about it.
        retryable: false,
        error:
          'No social account is connected to this project yet, so nothing was published. Connect one in Social Accounts and try again.',
      }
    }

    const platformIds = resolveAccountIdsForPlatform(req.platform, brandAccounts)
    const wantedMixpost = brandAccounts.find((a) => String(a.id) === req.account_id)
    const accountIds = wantedMixpost && platformIds.includes(wantedMixpost.id)
      ? [wantedMixpost.id]
      : []
    if (accountIds.length === 0) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
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
        retryable: false,
        error: `No Mixpost account connected for ${req.platform}.`,
      }
    }

    // The account this post is actually going to, not just its id.
    // buildPlatformOptions below needs the PROVIDER — 'facebook_page', not
    // 'facebook' — and a bare account id cannot tell anyone which it is.
    const account = brandAccounts.find((a) => a.id === accountIds[0])

    /*
     * Upload media, and refuse the post if any of it did not arrive.
     *
     * THE FAULT: this loop was `if (uploaded) mediaIds.push(...)`. A failed
     * upload was not an error, it was an absence — the post went out with the
     * remaining files, or with none, as text. Two wrong text-only posts reached
     * Facebook that way before `publish_to_social` was made to fail loudly, and
     * this path still had the silent version. A post that is missing the thing
     * it was about is worse than a post that did not go out, because nobody is
     * told to look.
     */
    const mediaIds: number[] = []
    let mediaFailures = 0
    for (const m of req.media) {
      // Cache hit: Mixpost already holds this file and re-transcoding it costs
      // ~380s on a large video. See PublishMedia.mixpost_media_id.
      if (typeof m.mixpost_media_id === 'number' && m.mixpost_media_id > 0) {
        mediaIds.push(m.mixpost_media_id)
        continue
      }

      const uploaded = await uploadMediaFromUrl(m.url, m.alt_text)
      if (!uploaded) {
        mediaFailures += 1
        // The URL is signed and carries a token, so it is logged, never
        // returned — a tool's returned string is read aloud to the owner.
        console.error('[dispatcher] Mixpost media upload failed for', m.url.split('?')[0])
        continue
      }
      mediaIds.push(uploaded.id)

      // Fill the cache the branch above reads. Only the two columns whose
      // values we actually have: uploadMediaFromUrl returns the numeric id and
      // not the companion uuid, and PostgREST rejects an update WHOLESALE if it
      // names a column that does not exist — one wrong key silently drops the
      // whole write, cache and timestamp together.
      if (m.media_item_id) {
        const { error: cacheError } = await admin
          .from('media_items')
          .update({
            mixpost_media_id: uploaded.id,
            mixpost_cached_at: new Date().toISOString(),
          })
          .eq('id', m.media_item_id)
        if (cacheError) {
          // A cold cache costs time, not correctness. Never fail a publish for it.
          console.error('[dispatcher] Could not cache Mixpost media id:', cacheError.message)
        }
      }
    }

    if (mediaFailures > 0) {
      await logRun({
        scheduledPostId: req.scheduled_post_id,
        brandId: req.brand_id,
        accountId: req.account_id,
        platform: req.platform,
        publisher: 'mixpost',
        status: 'failed',
        attempt,
        error: `${mediaFailures} of ${req.media.length} media items failed to upload`,
        durationMs: Date.now() - start,
      })
      return {
        ok: false,
        publisher: 'mixpost',
        // Transport, not a decision: the same file usually uploads next time.
        retryable: true,
        error: `Nothing was published — ${mediaFailures} of ${req.media.length} images or videos did not upload. The post was held back rather than going out incomplete, and it will be tried again shortly.`,
      }
    }

    const fullCaption = buildCaption(req)

    /*
     * Per-platform settings, on the one door.
     *
     * THE FAULT: the same stored row published with different settings
     * depending on which of five paths sent it. /api/scheduled-posts/publish-now
     * was the only path that attached an `options` key at all, and attached it
     * FLAT — `{ type: 'reel', privacy_level: '…', visibility: 'PUBLIC' }`.
     * Mixpost Pro runs `Arr::only($version['options'], array_keys($providers))`
     * (PostFormRequest.php:59 and :99, read from the running container on
     * 2026-08-17), so options must be keyed by PROVIDER and a flat object
     * matches no provider key and is discarded without a word. The dispatcher
     * and the cron sent no options at all. So the owner picked "Reel", one
     * button dropped the choice on the floor and the other looked like it kept
     * it, and the video published pillarboxed either way.
     *
     * buildPlatformOptions is imported rather than re-implemented on purpose:
     * a second copy of these key names is exactly how the paths came to
     * disagree, and it is the copy with a test behind it
     * (src/lib/mixpost/platform-options.test.ts).
     */
    const version: MixpostVersion = {
      account_id: accountIds[0]!,
      is_original: true,
      content: [
        {
          body: fullCaption,
          media: mediaIds,
          url: null,
          // Videos still lose their poster frame here. PublishMedia now carries
          // `thumbnail_url`, but MixpostVersion types this field as `never[]`
          // (src/lib/mixpost/client.ts:52), so only [] is assignable. Widening
          // it to string[] is a one-line change in a file this change does not
          // own; until then, sending nothing is honest and sending a cast is not.
          video_thumbs: [],
        },
      ],
      options: buildPlatformOptions(
        // The provider, with the platform only as a last resort. They differ:
        // Facebook is 'facebook_page', and Arr::only drops the wrong one.
        account?.provider ?? req.platform,
        req.post_type ?? null,
        // The bare caption, not fullCaption — deriveYoutubeTitle takes the first
        // real line, and the first line of a caption with the brand's sign-off
        // appended is still the caption, but hashtags and signature have no
        // business in a video title.
        req.caption,
        {
          ...(req.metadata ?? {}),
          // Only the three composer choices that Mixpost Pro's
          // YoutubePostOptions actually declares — title (max 256), status
          // (public|private|unlisted), made_for_kids — read from its rules()
          // on the running container on 2026-08-17. Every other key the
          // composer collects travels in req.platform_options and is NOT sent:
          // Arr::only would discard it silently, and a setting that looks
          // applied but was thrown away is worse than one the owner can see is
          // missing.
          ...(req.platform === 'youtube' && req.platform_options
            ? {
                ...(typeof req.platform_options.title === 'string' && req.platform_options.title
                  ? { youtube_title: req.platform_options.title }
                  : {}),
                ...(typeof req.platform_options.privacy === 'string'
                  ? { youtube_status: req.platform_options.privacy }
                  : {}),
                ...(typeof req.platform_options.made_for_kids === 'boolean'
                  ? { made_for_kids: req.platform_options.made_for_kids }
                  : {}),
              }
            : {}),
        },
      ),
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
        brandId: req.brand_id,
        accountId: req.account_id,
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
        // Mixpost has accepted the post, not published it. Confirmation arrives
        // later on the post.published webhook, so claiming it here would be the
        // same overstatement the Zernio path was fixed for.
        confirmed: false,
        external_post_id: result.uuid,
      }
    }

    const runId = await logRun({
      scheduledPostId: req.scheduled_post_id,
      brandId: req.brand_id,
      accountId: req.account_id,
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
        brandId: req.brand_id,
        accountId: req.account_id,
        platform: req.platform,
        error: 'Mixpost createPost returned null',
        attempt,
      })
    }

    return {
      ok: false,
      publisher: 'mixpost',
      // Mixpost gave back nothing at all. That is an unanswered call, not a
      // refusal of the content.
      retryable: true,
      error: 'Mixpost publishing failed.',
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - start

    const runId = await logRun({
      scheduledPostId: req.scheduled_post_id,
      brandId: req.brand_id,
      accountId: req.account_id,
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
        brandId: req.brand_id,
        accountId: req.account_id,
        platform: req.platform,
        error,
        attempt,
      })
    }

    return { ok: false, publisher: 'mixpost', retryable: true, error }
  }
}
