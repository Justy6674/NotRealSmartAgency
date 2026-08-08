/**
 * Where one piece of work ends and the next begins.
 *
 * Everything for a brand landed in one endless scroll, so by the third clip
 * there was no telling which video an answer belonged to, and the Director
 * carried the whole day's argument into a fresh idea. There was no way to say
 * "that one's done, start something new" — the only options were to keep
 * scrolling or to have nothing.
 *
 * Starting something new must not DELETE anything. The conversation is the
 * record of what was decided, and a marketing platform that throws that away
 * to tidy the screen is worse than the mess. So this is a line drawn across
 * it: the screen starts again from the line, everything before it stays
 * exactly where it was, and what mattered is written to the brand's memory
 * first so the Director still knows it.
 *
 * Stored as a memory row rather than a new column — it is a fact about the
 * brand, the table already holds those, and a schema change on a live database
 * is not worth it for one timestamp.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** One boundary per brand per person. */
export function boundaryKey(brandSlug: string): string {
  return `telegram-thread-start-${brandSlug}`
}

export function boundaryNamespace(brandSlug: string): string {
  return `nrs-${brandSlug}`
}

/**
 * When the current piece of work started.
 *
 * Null means never reset — show everything, which is the right answer for a
 * brand that has only ever had one thread.
 */
export async function readThreadStart(
  admin: SupabaseClient,
  { brandId, brandSlug, userId }: { brandId: string; brandSlug: string; userId: string },
): Promise<number | null> {
  const { data } = await admin
    .from('agent_memories')
    .select('value')
    .eq('key', boundaryKey(brandSlug))
    .eq('namespace', boundaryNamespace(brandSlug))
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .maybeSingle()

  const raw = (data?.value as { started_at?: unknown } | null)?.started_at
  if (typeof raw !== 'string') return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Draw the line at `now`.
 *
 * Upserted by hand rather than with `upsert()`, because the table has no
 * unique constraint on this combination and a real upsert would need one — a
 * migration, for a row we write once a day at most.
 */
export async function setThreadStart(
  admin: SupabaseClient,
  {
    brandId, brandSlug, userId, at,
  }: { brandId: string; brandSlug: string; userId: string; at: Date },
): Promise<boolean> {
  const key = boundaryKey(brandSlug)
  const namespace = boundaryNamespace(brandSlug)
  const value = { started_at: at.toISOString() }

  const { data: existing } = await admin
    .from('agent_memories')
    .select('id')
    .eq('key', key)
    .eq('namespace', namespace)
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await admin
      .from('agent_memories')
      .update({ value, updated_at: at.toISOString() })
      .eq('id', existing.id)
    return !error
  }

  const { error } = await admin.from('agent_memories').insert({
    key,
    namespace,
    user_id: userId,
    brand_id: brandId,
    value,
    memory_type: 'system',
    source: 'telegram-mini-app',
    // Not a fact about marketing — a bookmark. Tagged so it is never mistaken
    // for something to tell the Director about the brand.
    tags: ['thread-boundary'],
  })
  return !error
}
