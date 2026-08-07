import { createClient } from '@supabase/supabase-js'
import { embedText } from './embeddings'
import type { ExtractedFact } from './fact-extractor'

// ---------------------------------------------------------------------------
// Memory Store v2 — semantic dedup + vector search
//
// Uses pgvector embeddings for similarity search and deduplication.
// Falls back to keyword search (ruflo pattern) on embedding failure.
// ---------------------------------------------------------------------------

// ---- Types ----------------------------------------------------------------

export interface MemoryStoreResult {
  action: 'created' | 'updated' | 'skipped'
  key: string
}

export interface MemorySearchResult {
  key: string
  namespace: string
  value: string | Record<string, unknown>
  tags: string[]
  memory_type: string
  confidence: number
  similarity: number
}

// ---- Supabase client ------------------------------------------------------

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ---- Helpers --------------------------------------------------------------

function generateKey(fact: string): string {
  // Deterministic key from fact text (first 80 chars, slugified)
  return fact
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

function tryParseJson(value: string): string | Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return typeof parsed === 'object' && parsed !== null ? parsed : value
  } catch {
    return value
  }
}

// ---- Store ----------------------------------------------------------------

/**
 * Store a fact with semantic deduplication.
 *
 * 1. Embed the fact text
 * 2. Check for >0.85 similarity existing memory via match_memories
 * 3. If match: UPDATE existing (merge tags, bump updated_at, average confidence)
 * 4. If no match: INSERT new row with embedding
 * 5. On embedding failure: insert without embedding (graceful degradation)
 */
export async function memoryStoreV2(
  fact: ExtractedFact,
  namespace: string,
  userId: string,
  brandId: string,
  conversationId?: string
): Promise<MemoryStoreResult> {
  const supabase = getAdminClient()
  const key = generateKey(fact.fact)

  if (!key) return { action: 'skipped', key: '' }

  try {
    // Step 1: Embed the fact
    const embedding = await embedText(fact.fact)
    const hasEmbedding = embedding.length > 0

    // Step 2: Check for similar existing memories (only if we have an embedding)
    if (hasEmbedding) {
      try {
        const { data: matches } = await supabase.rpc('match_memories', {
          query_embedding: embedding,
          match_threshold: 0.85,
          match_count: 1,
          filter_namespace: namespace,
          filter_user_id: userId,
          filter_brand_id: brandId,
        })

        if (matches && matches.length > 0) {
          const existing = matches[0]

          // Step 3: Merge into existing memory
          const existingTags = (existing.tags ?? []) as string[]
          const mergedTags = [...new Set([...existingTags, ...fact.tags])]
          const avgConfidence = ((existing.confidence ?? 0.7) + fact.confidence) / 2

          const { error: updateError } = await supabase
            .from('agent_memories')
            .update({
              value: fact.fact,
              tags: mergedTags,
              confidence: Math.round(avgConfidence * 100) / 100,
              memory_type: fact.type,
              embedding,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)

          if (updateError) {
            console.error('[memory/v2] Update existing memory failed:', updateError.message)
          }

          return { action: 'updated', key: existing.key ?? key }
        }
      } catch (rpcErr) {
        // match_memories RPC failed — fall through to insert
        console.error('[memory/v2] match_memories RPC failed:', rpcErr)
      }
    }

    // Step 4: Insert new memory
    const insertPayload: Record<string, unknown> = {
      key,
      namespace,
      value: fact.fact,
      tags: fact.tags,
      memory_type: fact.type,
      confidence: fact.confidence,
      user_id: userId,
      brand_id: brandId,
      isolation_status: 'active',
      updated_at: new Date().toISOString(),
    }

    if (hasEmbedding) {
      insertPayload.embedding = embedding
    }

    if (conversationId) {
      insertPayload.conversation_id = conversationId
    }

    const { error: insertError } = await supabase
      .from('agent_memories')
      .insert(insertPayload)

    if (insertError) {
      // Duplicate key — update instead
      if (insertError.code === '23505') {
        const { error: upsertError } = await supabase
          .from('agent_memories')
          .update({
            value: fact.fact,
            tags: fact.tags,
            confidence: fact.confidence,
            memory_type: fact.type,
            ...(hasEmbedding ? { embedding } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('key', key)
          .eq('namespace', namespace)

        if (upsertError) {
          console.error('[memory/v2] Upsert fallback failed:', upsertError.message)
          return { action: 'skipped', key }
        }

        return { action: 'updated', key }
      }

      console.error('[memory/v2] Insert failed:', insertError.message)
      return { action: 'skipped', key }
    }

    return { action: 'created', key }
  } catch (err) {
    console.error('[memory/v2] memoryStoreV2 failed:', err)
    return { action: 'skipped', key }
  }
}

// ---- Search ---------------------------------------------------------------

/**
 * Semantic memory search using pgvector.
 *
 * 1. Embed the query
 * 2. Call match_memories Postgres function via supabase.rpc()
 * 3. Return ranked results
 * 4. On failure: fall back to keyword search (ruflo pattern)
 */
export async function memorySearchV2(
  query: string,
  namespace: string,
  userId: string,
  brandId: string,
  limit: number = 10
): Promise<MemorySearchResult[]> {
  const supabase = getAdminClient()

  try {
    // Step 1: Embed the query
    const embedding = await embedText(query)

    if (embedding.length === 0) {
      // No embedding — fall back to keyword search
      return keywordFallback(supabase, query, namespace, brandId, limit)
    }

    // Step 2: Semantic search via match_memories
    const { data, error } = await supabase.rpc('match_memories', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: limit,
      filter_namespace: namespace,
      filter_user_id: userId,
      filter_brand_id: brandId,
    })

    if (error) {
      console.error('[memory/v2] match_memories search failed:', error.message)
      return keywordFallback(supabase, query, namespace, brandId, limit)
    }

    if (!data?.length) return []

    return data.map((row: Record<string, unknown>) => ({
      key: (row.key as string) ?? '',
      namespace: (row.namespace as string) ?? namespace,
      value: typeof row.value === 'string' ? tryParseJson(row.value as string) : row.value as Record<string, unknown>,
      tags: (row.tags as string[]) ?? [],
      memory_type: (row.memory_type as string) ?? 'observation',
      confidence: (row.confidence as number) ?? 0.7,
      similarity: (row.similarity as number) ?? 0,
    }))
  } catch (err) {
    console.error('[memory/v2] memorySearchV2 failed:', err)
    return keywordFallback(supabase, query, namespace, brandId, limit)
  }
}

// ---- Keyword fallback (matches ruflo/client.ts pattern) -------------------

async function keywordFallback(
   
  supabase: any,
  query: string,
  namespace: string,
  brandId: string,
  limit: number
): Promise<MemorySearchResult[]> {
  try {
    const fetchLimit = Math.max(limit * 5, 50)

    const { data, error } = await supabase
      .from('agent_memories')
      .select('key, namespace, value, tags, memory_type, confidence, updated_at, created_at')
      .eq('namespace', namespace)
      .eq('brand_id', brandId)
      .eq('isolation_status', 'active')
      .order('updated_at', { ascending: false })
      .limit(fetchLimit)

    if (error || !data?.length) return []

    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)
    const now = Date.now()

     
    const scored: MemorySearchResult[] = data.map((row: any) => {
      const text = `${row.key} ${typeof row.value === 'string' ? row.value : JSON.stringify(row.value)}`.toLowerCase()
      const tags = (row.tags ?? []) as string[]

      let keywordHits = 0
      for (const word of queryWords) {
        if (text.includes(word)) keywordHits++
        if (tags.some((t: string) => t.toLowerCase().includes(word))) keywordHits += 0.5
      }
      const keywordScore = queryWords.length > 0 ? keywordHits / queryWords.length : 0

      const ageMs = now - new Date(row.updated_at ?? row.created_at).getTime()
      const ageDays = ageMs / (1000 * 60 * 60 * 24)
      const recencyScore = Math.exp(-ageDays / 14)

      const totalScore = queryWords.length > 0
        ? keywordScore * 0.6 + recencyScore * 0.4
        : recencyScore

      return {
        key: row.key as string,
        namespace: row.namespace as string,
        value: typeof row.value === 'string' ? tryParseJson(row.value as string) : row.value as Record<string, unknown>,
        tags: tags,
        memory_type: (row.memory_type as string) ?? 'observation',
        confidence: (row.confidence as number) ?? 0.7,
        similarity: totalScore,
      }
    })

    scored.sort((a, b) => b.similarity - a.similarity)
    return scored.slice(0, limit)
  } catch {
    return []
  }
}
