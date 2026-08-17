import { randomUUID } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { publishToPlatform } from './dispatcher'
import type { PublishRequest, PublishResult } from './types'
import {
  OWNER_NO_TICK,
  OWNER_POSTING_PAUSED,
  accountIdsFromMetadata,
  captionForAccount,
  postingPausedOf,
} from './transport'

export async function lockScheduledPost(postId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('lock_scheduled_post', { p_id: postId })
  if (error) {
    console.error('[publish-ticked] lock failed:', error.message)
    return null
  }
  return data as Record<string, unknown> | null
}

async function successfulAccountIds(scheduledPostId: string): Promise<Set<string>> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('publisher_runs')
    .select('account_id')
    .eq('scheduled_post_id', scheduledPostId)
    .eq('status', 'success')
  return new Set((data ?? []).map((row) => String(row.account_id)))
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
      publisher: 'zernio',
      retryable: false,
      error: OWNER_POSTING_PAUSED,
    }
  }

  const ids = accountIdsFromMetadata(metadata)
  if (ids.length === 0) {
    return {
      ok: false,
      publisher: 'zernio',
      retryable: false,
      error: OWNER_NO_TICK,
    }
  }

  const already = await successfulAccountIds(req.scheduled_post_id)
  const remaining = ids.filter((id) => !already.has(id))
  if (remaining.length === 0) {
    return {
      ok: true,
      publisher: 'zernio',
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
        idempotency_key: randomUUID(),
      },
      1,
      options,
    )
    results.push(result)
  }

  const allOk = results.every((r) => r.ok)
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
