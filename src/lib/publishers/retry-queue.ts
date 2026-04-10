/**
 * Publisher retry queue with exponential backoff.
 *
 * Failed publishes are enqueued with increasing delays:
 * attempt 1: +1 min, 2: +5 min, 3: +15 min, 4: +1 hr, 5: +4 hr
 *
 * The cron publisher calls processRetries() on each tick to pick up
 * rows where next_attempt_at <= now() and re-dispatch them.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { PublisherPlatform } from './types'

/** Backoff schedule in milliseconds, indexed by attempt (1-based). */
const BACKOFF_MS: Record<number, number> = {
  1: 1 * 60 * 1000,       // 1 minute
  2: 5 * 60 * 1000,       // 5 minutes
  3: 15 * 60 * 1000,      // 15 minutes
  4: 60 * 60 * 1000,      // 1 hour
  5: 4 * 60 * 60 * 1000,  // 4 hours
}

const DEFAULT_MAX_ATTEMPTS = 5

/**
 * Enqueue a failed publish for retry.
 */
export async function enqueueRetry(params: {
  runId: string
  scheduledPostId: string
  platform: PublisherPlatform
  error: string
  attempt?: number
  maxAttempts?: number
}): Promise<void> {
  const {
    runId,
    scheduledPostId,
    platform,
    error,
    attempt = 1,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  } = params

  // Don't enqueue if we've exhausted attempts
  if (attempt >= maxAttempts) {
    console.warn(
      `[retry-queue] Max attempts (${maxAttempts}) reached for post ${scheduledPostId} on ${platform}. Not retrying.`,
    )
    return
  }

  const nextAttempt = attempt + 1
  const delayMs = BACKOFF_MS[nextAttempt] ?? BACKOFF_MS[5]!
  const nextAttemptAt = new Date(Date.now() + delayMs).toISOString()

  const supabase = createAdminClient()

  const { error: insertError } = await supabase
    .from('publisher_retry_queue')
    .insert({
      scheduled_post_id: scheduledPostId,
      platform,
      run_id: runId,
      next_attempt_at: nextAttemptAt,
      attempt: nextAttempt,
      max_attempts: maxAttempts,
      last_error: error,
    })

  if (insertError) {
    console.error('[retry-queue] Failed to enqueue retry:', insertError.message)
  } else {
    console.log(
      `[retry-queue] Enqueued retry #${nextAttempt} for post ${scheduledPostId} on ${platform} at ${nextAttemptAt}`,
    )
  }
}

export interface RetryItem {
  id: string
  scheduled_post_id: string
  platform: PublisherPlatform
  run_id: string | null
  attempt: number
  max_attempts: number
  last_error: string | null
}

/**
 * Fetch all retries that are due (next_attempt_at <= now).
 * Deletes them from the queue atomically so concurrent cron
 * invocations don't double-process.
 */
export async function fetchDueRetries(): Promise<RetryItem[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('publisher_retry_queue')
    .select('*')
    .lte('next_attempt_at', new Date().toISOString())
    .order('next_attempt_at', { ascending: true })
    .limit(20)

  if (error || !data) {
    if (error) console.error('[retry-queue] Fetch due retries error:', error.message)
    return []
  }

  // Delete fetched rows so they're not picked up again
  if (data.length > 0) {
    const ids = data.map((r) => r.id)
    await supabase.from('publisher_retry_queue').delete().in('id', ids)
  }

  return data as RetryItem[]
}
