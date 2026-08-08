/**
 * Remember being corrected, so the same mistake costs the owner once.
 *
 * NRS already DETECTS its own failures deterministically — a forbidden brand
 * spelling replaced, a claimed draft update with no tool call behind it — and
 * then throws that away. It logs a warning to a platform log nobody reads and
 * makes the identical mistake an hour later. On 8 August 2026 "ScentSell" was
 * corrected repeatedly and each correction taught the system nothing.
 *
 * A detected correction is the highest-quality training signal there is: it is
 * not inferred from tone, it is a fact about a specific failure that a
 * deterministic check caught. Written into the same memory store the prompt
 * already reads, it becomes "you have got this wrong before, here is how".
 *
 * NOT written into gbrain. That is the owner's own record of what he decided,
 * and a marketing agent appending to it would pollute the one source of truth
 * he trusts. This goes in NRS's memory; his brain stays his.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type CorrectionKind = 'brand_name' | 'unbacked_claim' | 'wrong_product'

/** One per kind per brand — a running tally, not 400 separate rows. */
function keyFor(kind: CorrectionKind, brandSlug: string): string {
  return `correction-${kind}-${brandSlug}`
}

interface CorrectionRecord {
  kind: CorrectionKind
  /** How many times this has been caught. The number is the lesson. */
  count: number
  /** The most recent few, verbatim — a count alone teaches nothing. */
  examples: string[]
  lesson: string
  lastAt: string
}

const MAX_EXAMPLES = 5

/**
 * Note that a check fired.
 *
 * Upserted by hand: the table has no unique constraint on this combination,
 * and adding one is a migration for something written a few times a day.
 * Best-effort throughout — recording a lesson must never fail a reply.
 */
export async function recordCorrection(
  admin: SupabaseClient,
  {
    kind, brandId, brandSlug, userId, detail, lesson,
  }: {
    kind: CorrectionKind
    brandId: string
    brandSlug: string
    userId: string
    /** What was actually wrong, e.g. the spelling that was replaced. */
    detail: string
    lesson: string
  },
): Promise<void> {
  const key = keyFor(kind, brandSlug)
  const namespace = `nrs-${brandSlug}`
  const now = new Date().toISOString()

  try {
    const { data: existing } = await admin
      .from('agent_memories')
      .select('id, value')
      .eq('key', key)
      .eq('namespace', namespace)
      .eq('user_id', userId)
      .eq('brand_id', brandId)
      .maybeSingle()

    const previous = (existing?.value ?? null) as CorrectionRecord | null
    const examples = [detail, ...(previous?.examples ?? [])]
      // Deduped: the same wrong spelling caught twenty times is one example
      // and a count of twenty, not twenty identical lines crowding the prompt.
      .filter((value, index, all) => all.indexOf(value) === index)
      .slice(0, MAX_EXAMPLES)

    const record: CorrectionRecord = {
      kind,
      count: (previous?.count ?? 0) + 1,
      examples,
      lesson,
      lastAt: now,
    }

    if (existing?.id) {
      await admin.from('agent_memories')
        .update({ value: record, updated_at: now })
        .eq('id', existing.id)
      return
    }

    await admin.from('agent_memories').insert({
      key,
      namespace,
      user_id: userId,
      brand_id: brandId,
      value: record,
      // A preference, not an observation: it changes what the Director should
      // do, and the prompt builder sorts preferences above observations.
      memory_type: 'preference',
      source: 'nrs-self-correction',
      tags: ['correction', kind],
    })
  } catch (error) {
    console.error('[record-correction]', error)
  }
}

/**
 * The corrections as prompt text.
 *
 * Leads with the count, because "you have done this 14 times" carries weight
 * that "avoid this" does not.
 */
export async function correctionsForPrompt(
  admin: SupabaseClient,
  { brandId, brandSlug, userId }: { brandId: string; brandSlug: string; userId: string },
): Promise<string | null> {
  const { data } = await admin
    .from('agent_memories')
    .select('value')
    .eq('namespace', `nrs-${brandSlug}`)
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .eq('source', 'nrs-self-correction')

  const records = (data ?? [])
    .map((row) => row.value as CorrectionRecord | null)
    .filter((record): record is CorrectionRecord => Boolean(record?.lesson))
    .sort((a, b) => b.count - a.count)

  if (records.length === 0) return null

  return [
    '**MISTAKES YOU HAVE ALREADY MADE ON THIS BRAND.** Each was caught by a check,',
    'not guessed at. The count is how many times it has cost the owner.',
    '',
    ...records.map((record) => {
      const examples = record.examples.length > 0 ? ` (e.g. ${record.examples.slice(0, 3).join(', ')})` : ''
      return `- ${record.count}x — ${record.lesson}${examples}`
    }),
  ].join('\n')
}
