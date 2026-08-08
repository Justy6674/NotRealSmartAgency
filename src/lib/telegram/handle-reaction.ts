/**
 * Turn a 👍 into something the Director actually learns from.
 *
 * A reaction arrives carrying a chat id, a user id, an emoji and a message id
 * — and nothing about what was said. The words live on the job that sent that
 * message, which is why the ids are recorded when the answer goes out. Without
 * that link a reaction is a thumb pointing at nothing.
 *
 * Recorded, never acted on. A 👎 notes that a piece of copy missed; it does
 * not rewrite, retry or send anything. Acting silently on an ambiguous tap is
 * how a marketing tool starts publishing things nobody asked for.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { lessonFrom, type ReactionEvent } from './reactions'

export interface ReactionOutcome {
  recorded: boolean
  /** Why not, when not — so the webhook can log something useful. */
  reason?: string
}

/**
 * Find the answer that was reacted to, and write down the lesson.
 *
 * Scoped by the reacting account: a reaction is feedback from whoever tapped
 * it, and attributing it to the wrong person would teach the Director the
 * wrong taste.
 */
export async function recordReaction(
  admin: SupabaseClient,
  event: ReactionEvent,
  { userId, brandId, brandSlug }: { userId: string; brandId: string; brandSlug: string },
): Promise<ReactionOutcome> {
  // Which answer carried that message? Only recent jobs are searched — a
  // reaction to something from last month teaches nothing about now, and
  // scanning the whole table for every thumb would be wasteful.
  const { data: jobs } = await admin
    .from('mcp_jobs')
    .select('id, result, created_at')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .eq('channel', 'telegram')
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(40)

  const match = (jobs ?? []).find((job) => {
    const ids = (job.result as { telegram_message_ids?: unknown } | null)?.telegram_message_ids
    return Array.isArray(ids) && ids.includes(event.messageId)
  })

  const reactedText = typeof (match?.result as { response?: unknown } | null)?.response === 'string'
    ? ((match!.result as { response: string }).response)
    : null

  if (!reactedText) {
    // Nothing to learn from a thumb we cannot attach words to, and inventing
    // an association would be worse than dropping it.
    return { recorded: false, reason: 'no matching answer for that message' }
  }

  const { error } = await admin.from('agent_memories').insert({
    key: `reaction-${event.messageId}`,
    namespace: `nrs-${brandSlug}`,
    user_id: userId,
    brand_id: brandId,
    value: {
      lesson: lessonFrom(event, reactedText),
      verdict: event.verdict,
      emoji: event.emoji,
      reacted_at: new Date().toISOString(),
    },
    memory_type: 'preference',
    source: 'telegram-reaction',
    tags: ['reaction', event.verdict],
  })

  if (error) {
    console.error('[reaction] not stored:', error.message)
    return { recorded: false, reason: error.message }
  }
  return { recorded: true }
}

/**
 * Recent verdicts, as a block of prompt text.
 *
 * Kept short and recent on purpose. Taste changes, and a year of thumbs would
 * drown the brand's actual voice in a list of old opinions.
 */
export async function reactionLessonsForPrompt(
  admin: SupabaseClient,
  { userId, brandId, brandSlug, limit = 8 }: {
    userId: string; brandId: string; brandSlug: string; limit?: number
  },
): Promise<string | null> {
  const { data } = await admin
    .from('agent_memories')
    .select('value')
    .eq('namespace', `nrs-${brandSlug}`)
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .eq('source', 'telegram-reaction')
    .order('created_at', { ascending: false })
    .limit(limit)

  const lessons = (data ?? [])
    .map((row) => (row.value as { lesson?: unknown } | null)?.lesson)
    .filter((lesson): lesson is string => typeof lesson === 'string' && lesson.length > 0)

  if (lessons.length === 0) return null

  return [
    '**What the owner has reacted to before.** These are his own verdicts on your writing,',
    'given a tap at a time. Weigh them above any general instinct about what good copy is:',
    ...lessons.map((lesson) => `- ${lesson}`),
  ].join('\n')
}
