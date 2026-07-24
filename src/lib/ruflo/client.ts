import { createClient } from '@supabase/supabase-js'
import type { MemoryEntry, MemorySearchResult } from './types'

// ---------------------------------------------------------------------------
// Runtime memory client
//
// Ruflo MCP runs via stdio (Claude Code sessions) for agent management.
// At runtime (Vercel), we use Supabase as the memory store. This client
// wraps Supabase for memory CRUD that agents use during chat.
// ---------------------------------------------------------------------------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ---------------------------------------------------------------------------
// Memory Store
// ---------------------------------------------------------------------------

export async function memoryStore(
  key: string,
  value: string | Record<string, unknown>,
  namespace: string,
  tags: string[] = [],
  scope?: { brandId: string; userId?: string },
): Promise<void> {
  const supabase = getAdminClient()
  const serialised = typeof value === 'string' ? value : JSON.stringify(value)

  const { error } = await supabase
    .from('agent_memories')
    .upsert(
      {
        key,
        namespace,
        value: serialised,
        tags,
        brand_id: scope?.brandId ?? null,
        user_id: scope?.userId ?? null,
        isolation_status: scope?.brandId ? 'active' : 'quarantined',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key,namespace' }
    )

  if (error) {
    console.error('[ruflo/memory] Store error:', error.message)
  }
}

// ---------------------------------------------------------------------------
// Memory Search (keyword-based via Supabase full-text or tag filter)
// For semantic search, Ruflo MCP is used during dev sessions.
// ---------------------------------------------------------------------------

export async function memorySearch(
  query: string,
  namespace: string,
  brandId: string,
  limit: number = 10
): Promise<MemorySearchResult[]> {
  const supabase = getAdminClient()

  try {
    // Strategy: fetch more memories than needed, then rank by keyword relevance
    // This gives us the best of both: recent + relevant
    const fetchLimit = Math.max(limit * 5, 50) // Over-fetch to allow ranking

    const { data, error } = await supabase
      .from('agent_memories')
      .select('key, namespace, value, tags, created_at, updated_at')
      .eq('namespace', namespace)
      .eq('brand_id', brandId)
      .eq('isolation_status', 'active')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit)

    if (error) {
      console.error('[ruflo/memory] Search error:', error.message)
      return []
    }

    if (!data?.length) return []

    // Score each memory by keyword relevance + recency
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const now = Date.now()

    const scored = data.map((row) => {
      const text = `${row.key} ${typeof row.value === 'string' ? row.value : JSON.stringify(row.value)}`.toLowerCase()
      const tags = (row.tags ?? []) as string[]

      // Keyword match score (0-1): how many query words appear in the memory
      let keywordHits = 0
      for (const word of queryWords) {
        if (text.includes(word)) keywordHits++
        if (tags.some(t => t.toLowerCase().includes(word))) keywordHits += 0.5
      }
      const keywordScore = queryWords.length > 0 ? keywordHits / queryWords.length : 0

      // Recency score (0-1): exponential decay, half-life of 14 days
      const ageMs = now - new Date(row.updated_at ?? row.created_at).getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      const recencyScore = Math.exp(-ageDays / 14)

      // Priority boost for important memory types (brand rules, user preferences)
      let priorityBoost = 0
      const keyLower = row.key.toLowerCase()
      if (keyLower.includes('rule') || keyLower.includes('never') || keyLower.includes('always')) priorityBoost = 0.3
      if (keyLower.includes('prefer') || keyLower.includes('voice') || keyLower.includes('brand')) priorityBoost = 0.2
      if (keyLower.includes('decision') || keyLower.includes('strategy')) priorityBoost = 0.15
      if (tags.includes('user_preference') || tags.includes('brand_rule')) priorityBoost = 0.3
      if (tags.includes('negative_preference')) priorityBoost = 0.25

      // Combined score: 50% keyword relevance + 30% recency + 20% priority
      const totalScore = (keywordScore * 0.5) + (recencyScore * 0.3) + (priorityBoost * 0.2)
      // If no query words, fall back to recency + priority only
      const finalScore = queryWords.length > 0 ? totalScore : (recencyScore * 0.7) + (priorityBoost * 0.3)

      return { row, score: finalScore }
    })

    // Sort by score descending, take top N
    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, limit).map(({ row, score }) => ({
      key: row.key,
      namespace: row.namespace,
      value: tryParseJson(row.value),
      similarity: score,
      tags: (row.tags ?? []) as string[],
    }))
  } catch {
    // Timeout or network error — return empty, chat continues without memory
    return []
  }
}

// ---------------------------------------------------------------------------
// Memory Retrieve (exact key lookup)
// ---------------------------------------------------------------------------

export async function memoryRetrieve(
  key: string,
  namespace: string,
  brandId: string,
): Promise<MemoryEntry | null> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('agent_memories')
    .select('*')
    .eq('key', key)
    .eq('namespace', namespace)
    .eq('brand_id', brandId)
    .eq('isolation_status', 'active')
    .single()

  if (error || !data) return null

  return {
    key: data.key,
    namespace: data.namespace,
    value: tryParseJson(data.value),
    tags: data.tags ?? [],
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Memory Delete
// ---------------------------------------------------------------------------

export async function memoryDelete(
  key: string,
  namespace: string,
  brandId: string,
): Promise<void> {
  const supabase = getAdminClient()

  await supabase
    .from('agent_memories')
    .delete()
    .eq('key', key)
    .eq('namespace', namespace)
    .eq('brand_id', brandId)
    .eq('isolation_status', 'active')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryParseJson(value: string): string | Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null ? parsed : value
  } catch {
    return value
  }
}
