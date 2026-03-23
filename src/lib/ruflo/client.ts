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
  tags: string[] = []
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
  limit: number = 10
): Promise<MemorySearchResult[]> {
  const supabase = getAdminClient()

  try {
    // Search by namespace + order by recency (most recent = most relevant)
    const { data, error } = await supabase
      .from('agent_memories')
      .select('key, namespace, value, tags, created_at')
      .eq('namespace', namespace)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[ruflo/memory] Search error:', error.message)
      return []
    }

    return (data ?? []).map((row) => ({
      key: row.key,
      namespace: row.namespace,
      value: tryParseJson(row.value),
      similarity: 1, // No semantic similarity in Supabase — sorted by recency
      tags: row.tags ?? [],
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
  namespace: string
): Promise<MemoryEntry | null> {
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('agent_memories')
    .select('*')
    .eq('key', key)
    .eq('namespace', namespace)
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
  namespace: string
): Promise<void> {
  const supabase = getAdminClient()

  await supabase
    .from('agent_memories')
    .delete()
    .eq('key', key)
    .eq('namespace', namespace)
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
