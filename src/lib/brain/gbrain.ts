/**
 * Read the owner's actual brain.
 *
 * NRS had a memory architecture — pgvector, typed memories, per-brand
 * namespaces — and it was a COMPLETELY SEPARATE BRAIN from the one the owner
 * has spent months building. Every decision, correction, spec and constraint
 * recorded across twelve projects in gbrain and Obsidian was invisible to the
 * Director. It felt like it had no memory because it had its own, three weeks
 * old, and none of his.
 *
 * ARCHITECTURE, and the reason this is a fifty-line file rather than a project.
 *
 * gbrain's brain is not local. `~/.gbrain/config.json` points at a hosted
 * Supabase Postgres, so a serverless function can query it directly — no CLI,
 * no daemon, no container, no sync job. And `gbrain search` is documented as
 * "Keyword search (tsvector)", which means `pages.search_vector` already
 * exists and is maintained. Full-text retrieval needs no embedding model at
 * all, which removes the only real obstacle: gbrain embeds with local Ollama,
 * unreachable from Vercel.
 *
 * So: 10,897 pages and 24,928 chunks, searchable from production, today,
 * without sending a single query to a third party. That last part matters —
 * TeleScribe, Tele360, DownDiary and downscale-derm handle patient data, and
 * a hosted embedder would have put their queries on someone else's server.
 *
 * READ ONLY. Nothing here writes to the brain. A marketing agent must never be
 * able to alter the record of what was decided.
 */

import { Client } from 'pg'

export interface BrainHit {
  slug: string
  title: string
  type: string
  /** The passage that matched, not the whole page. */
  excerpt: string
  /** Postgres text-search rank. Higher is better. */
  rank: number
  updatedAt: string | null
}

/** Long enough for a cold connection, short enough not to hold up a reply. */
const QUERY_TIMEOUT_MS = 8_000

export function brainConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return typeof env.GBRAIN_DATABASE_URL === 'string' && env.GBRAIN_DATABASE_URL.length > 0
}

/**
 * Turn a question into a tsquery.
 *
 * `websearch_to_tsquery` is the right function here: it accepts what a person
 * actually types, including quoted phrases and `or`, and it never throws on
 * punctuation. `to_tsquery` raises a syntax error on an apostrophe, which for
 * a brand called Scent Sell and a question like "what's our naming rule" would
 * mean the brain silently failing exactly when asked about itself.
 */
export async function searchBrain(
  question: string,
  { limit = 6, env = process.env }: { limit?: number; env?: Record<string, string | undefined> } = {},
): Promise<BrainHit[]> {
  const url = env.GBRAIN_DATABASE_URL
  if (!url || !question.trim()) return []

  const client = new Client({
    connectionString: url,
    // Supabase requires TLS; the pooler presents a cert the default Node trust
    // store does not carry, and failing closed here would mean no brain at all.
    ssl: { rejectUnauthorized: false },
    statement_timeout: QUERY_TIMEOUT_MS,
    connectionTimeoutMillis: QUERY_TIMEOUT_MS,
  })

  try {
    await client.connect()
    const { rows } = await client.query<{
      slug: string
      title: string
      type: string
      excerpt: string
      rank: number
      updated_at: Date | null
    }>(
      `SELECT slug,
              title,
              type,
              ts_headline('english', compiled_truth, websearch_to_tsquery('english', $1),
                          'MaxWords=60, MinWords=25, ShortWord=3, MaxFragments=2, FragmentDelimiter=" … "')
                AS excerpt,
              ts_rank(search_vector, websearch_to_tsquery('english', $1)) AS rank,
              updated_at
         FROM pages
        WHERE deleted_at IS NULL
          AND search_vector @@ websearch_to_tsquery('english', $1)
        ORDER BY rank DESC, updated_at DESC NULLS LAST
        LIMIT $2`,
      [question.trim(), Math.min(Math.max(limit, 1), 20)],
    )

    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      type: row.type,
      // ts_headline marks matches with <b>; the Director reads prose.
      excerpt: row.excerpt.replace(/<\/?b>/g, '').replace(/\s+/g, ' ').trim(),
      rank: Number(row.rank),
      updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
    }))
  } finally {
    // Never let a brain lookup take the reply down with it.
    await client.end().catch(() => {})
  }
}

/**
 * The hits as prompt text, with citations.
 *
 * Every line carries its slug so a claim can be traced back. The owner's own
 * rule: cite or it did not happen — a fact asserted from the brain with no
 * pointer is indistinguishable from one the model invented.
 */
export function brainContext(hits: readonly BrainHit[]): string | null {
  if (hits.length === 0) return null

  return [
    "**FROM THE OWNER'S BRAIN.** These are his own written decisions, specs and",
    'corrections, across every project. They outrank your own instincts and any',
    'general marketing knowledge. Cite the slug when you use one — a fact from',
    'the brain with no pointer cannot be told apart from one you made up.',
    '',
    ...hits.map((hit) => `- [${hit.slug}] ${hit.title}: ${hit.excerpt}`),
  ].join('\n')
}
