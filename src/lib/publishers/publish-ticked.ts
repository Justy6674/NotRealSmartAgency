import { createAdminClient } from '@/lib/supabase/admin'
import { outboundTextForReview } from '@/lib/agents/publish-gate'
import { outboundContentForReview, publishToPlatform } from './dispatcher'
import type { PublishRequest, PublishResult, PublisherBackend } from './types'
import {
  OWNER_NO_TICK,
  OWNER_POSTING_PAUSED,
  accountIdsFromMetadata,
  captionForAccount,
  postingPausedOf,
} from './transport'

/**
 * Owner-facing, and never cheerful about a post that did not go out.
 *
 * No vendor names: the owner has never been told what Mixpost or Zernio are,
 * and a message about a compliance fix is not the place to start.
 */
export const OWNER_LIVE_WORDING_OLDER =
  'This post is already live, and the wording has changed since it went out. Nothing was sent this time, so the live version still has the earlier wording — take it down or edit it on the account itself, then post this version.'

export const OWNER_LIVE_WORDING_UNKNOWN =
  'This post is already live, and there is no record of the exact wording that was sent. Nothing was sent again — read the live post before treating this wording as published.'

export const OWNER_SOME_ALREADY_LIVE =
  'The new wording went to the accounts that had not posted yet.'

/** Same key on every retry so Zernio x-request-id and publisher_runs unique index do their job. */
export function idempotencyKeyForAccount(scheduledPostId: string, accountId: string): string {
  return `${scheduledPostId}:${accountId}`
}

export async function lockScheduledPost(postId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('lock_scheduled_post', { p_id: postId })
  if (error) {
    console.error('[publish-ticked] lock failed:', error.message)
    return null
  }
  return data as Record<string, unknown> | null
}

/**
 * What was actually SENT to each account that has already published, not just
 * the fact that it did.
 *
 * `request_payload` carries the full caption and the platform options of the
 * send (dispatcher.logRun), so the words on the live post can be compared with
 * the words on the row now. Latest success per account wins.
 */
export type PriorSend = {
  /** The outbound words of that send, or null when the run recorded no caption. */
  words: string | null
}

/**
 * Is what is on the account still what this row would send?
 *
 * Unknown counts as different. A run whose payload never recorded the caption
 * cannot show that the live post matches, and "we cannot tell" reported as
 * "it is live and current" is the whole fault this guards.
 */
export function priorSendDiffers(prior: PriorSend | undefined, wordsNow: string): boolean {
  if (!prior) return false
  if (prior.words === null) return true
  return prior.words !== wordsNow
}

async function successfulSends(scheduledPostId: string): Promise<Map<string, PriorSend>> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('publisher_runs')
    .select('account_id, request_payload, finished_at')
    .eq('scheduled_post_id', scheduledPostId)
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
  if (error) console.error('[publish-ticked] successfulSends:', error.message)

  const out = new Map<string, PriorSend>()
  for (const row of data ?? []) {
    const accountId = String(row.account_id)
    if (out.has(accountId)) continue
    const payload = (row.request_payload ?? null) as Record<string, unknown> | null
    // `outbound_words` is what the door recorded itself, and it is the only
    // field that means the same thing on all three backends. The caption
    // fallback is for runs logged before it existed: the Zernio and Mixpost
    // paths stored the full caption there, so they still compare; the native
    // path stored the bare one, so an untouched post can read as edited. That
    // errs towards "we did not send it again", which is the safe direction.
    const recorded = typeof payload?.outbound_words === 'string' ? payload.outbound_words : null
    const caption = typeof payload?.caption === 'string' ? payload.caption : null
    out.set(accountId, {
      words:
        recorded ??
        (caption === null
          ? null
          : outboundWordsOf(caption, payload?.platform_options as Record<string, unknown> | null)),
    })
  }
  return out
}

/**
 * The comparable text of one send: caption plus every free-text option.
 *
 * Same function the regulatory gate reviews with, on purpose. An edit the gate
 * would treat as new content is an edit this must treat as new content —
 * otherwise the owner fixes a first comment, is told the post is live, and the
 * live post still carries the claim that was blocked.
 */
export function outboundWordsOf(caption: string, options: Record<string, unknown> | null | undefined): string {
  return outboundTextForReview({ caption, platformOptions: options ?? null }).trim()
}

async function lastSuccessfulPublisher(scheduledPostId: string): Promise<PublisherBackend | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('publisher_runs')
    .select('publisher')
    .eq('scheduled_post_id', scheduledPostId)
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const publisher = data?.publisher
  if (publisher === 'native' || publisher === 'mixpost' || publisher === 'zernio') return publisher
  return null
}

/**
 * One door call per ticked account. Partial success: the post stays
 * publishing while any run is in-flight; published only if every ticked id
 * succeeded; otherwise failed so Waiting still holds mixed posts.
 */
export async function publishTickedAccounts(
  req: Omit<PublishRequest, 'account_id' | 'idempotency_key'>,
  metadata: unknown,
  options?: Parameters<typeof publishToPlatform>[2],
): Promise<PublishResult> {
  const locked = await lockScheduledPost(req.scheduled_post_id)
  if (postingPausedOf(locked?.metadata ?? metadata)) {
    return {
      ok: false,
      publisher: 'unsent',
      retryable: false,
      error: OWNER_POSTING_PAUSED,
    }
  }

  const ids = accountIdsFromMetadata(metadata)
  if (ids.length === 0) {
    return {
      ok: false,
      publisher: 'unsent',
      retryable: false,
      error: OWNER_NO_TICK,
    }
  }

  const sent = await successfulSends(req.scheduled_post_id)
  const remaining = ids.filter((id) => !sent.has(id))

  /*
   * THE FAULT: this returned `{ ok: true, confirmed: true }` for any post whose
   * ticked accounts had all published once, without looking at WHAT they
   * published. So an owner who edited a caption — or a first comment — to fix a
   * compliance problem was told the post was live, while the live post still
   * carried the wording that had to be fixed. On a health brand that is a
   * $60,000 exposure being reported as done.
   *
   * Nothing here can edit a post that is already on the account, and sending it
   * again would put a second copy up beside the offending one. So the answer is
   * the honest one: say that nothing was sent and that the live version still
   * has the earlier wording.
   */
  const stale = ids.filter((id) =>
    priorSendDiffers(
      sent.get(id),
      // The words this account would get NOW, through the same function the
      // door records and the regulatory gate reviews. Rebuilding them here
      // instead is how the two answers get a chance to differ.
      outboundContentForReview({
        ...req,
        account_id: id,
        caption: captionForAccount(req.caption, metadata, id),
      }),
    ),
  )
  const staleWordingUnknown = stale.some((id) => sent.get(id)?.words === null)

  if (remaining.length === 0) {
    if (stale.length > 0) {
      return {
        ok: false,
        publisher: 'unsent',
        // Re-sending would duplicate the live post, not replace it. This is a
        // decision about the content, so it is never requeued.
        retryable: false,
        error: staleWordingUnknown ? OWNER_LIVE_WORDING_UNKNOWN : OWNER_LIVE_WORDING_OLDER,
      }
    }
    const lastPublisher = await lastSuccessfulPublisher(req.scheduled_post_id)
    return {
      ok: true,
      publisher: lastPublisher ?? 'mixpost',
      confirmed: true,
    }
  }

  const admin = createAdminClient()
  await admin
    .from('scheduled_posts')
    .update({ status: 'publishing' })
    .eq('id', req.scheduled_post_id)

  const results: PublishResult[] = []
  for (const accountId of remaining) {
    const result = await publishToPlatform(
      {
        ...req,
        account_id: accountId,
        caption: captionForAccount(req.caption, metadata, accountId),
        idempotency_key: idempotencyKeyForAccount(req.scheduled_post_id, accountId),
      },
      1,
      options,
    )
    results.push(result)
  }

  const allOk = results.every((r) => r.ok) && stale.length === 0
  const anyConfirmed = results.some((r) => r.confirmed)
  const last = results[results.length - 1]!

  await lockScheduledPost(req.scheduled_post_id)
  await admin
    .from('scheduled_posts')
    .update({
      status: allOk ? (anyConfirmed && results.every((r) => r.confirmed) ? 'published' : 'publishing') : 'failed',
      ...(allOk && results.every((r) => r.confirmed)
        ? { published_at: new Date().toISOString() }
        : {}),
    })
    .eq('id', req.scheduled_post_id)

  // Some accounts had already posted the earlier wording and cannot be
  // corrected from here. The rest have just had the new wording, so the send
  // is not a failure — but calling the post done would repeat the same lie in
  // a smaller way, so it is reported for what it is.
  if (results.every((r) => r.ok) && stale.length > 0) {
    return {
      ok: false,
      publisher: last.publisher,
      retryable: false,
      error: `${OWNER_SOME_ALREADY_LIVE} ${staleWordingUnknown ? OWNER_LIVE_WORDING_UNKNOWN : OWNER_LIVE_WORDING_OLDER}`,
    }
  }

  if (!allOk) {
    return {
      ok: false,
      publisher: last.publisher,
      retryable: results.some((r) => r.retryable),
      error: results.find((r) => !r.ok)?.error ?? OWNER_NO_TICK,
    }
  }

  return {
    ok: true,
    publisher: last.publisher,
    confirmed: results.every((r) => r.confirmed),
    external_post_id: last.external_post_id,
    external_permalink: last.external_permalink,
  }
}
