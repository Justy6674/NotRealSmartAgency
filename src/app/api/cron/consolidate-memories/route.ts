export const maxDuration = 300

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// GET /api/cron/consolidate-memories — weekly memory consolidation
//
// 1. Text-based dedup: within each namespace, find memories with overlapping
//    key phrases. When a cluster of >3 similar memories exists, keep the most
//    recent and delete the rest.
// 2. Staleness: delete conversation summaries older than 90 days.
// ---------------------------------------------------------------------------

/** Extract key phrases (3+ word sequences) from a string */
function extractPhrases(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)

  const phrases = new Set<string>()
  for (let i = 0; i <= words.length - 3; i++) {
    phrases.add(words.slice(i, i + 3).join(' '))
  }
  return phrases
}

/** Calculate Jaccard overlap between two phrase sets */
function phraseOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const phrase of a) {
    if (b.has(phrase)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

interface MemoryRow {
  id: string
  brand_id: string
  key: string
  value: string | Record<string, unknown>
  namespace: string
  memory_type: string | null
  updated_at: string
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const stats = { duplicatesRemoved: 0, staleRemoved: 0, errors: 0 }

  // ---- Step 1: Delete stale conversation summaries (>90 days) ---------------

  const ninetyDaysAgo = new Date(
    Date.now() - 90 * 24 * 60 * 60 * 1000
  ).toISOString()

  const { count: staleCount, error: staleError } = await supabase
    .from('agent_memories')
    .delete({ count: 'exact' })
    .eq('memory_type', 'conversation')
    .eq('isolation_status', 'active')
    .lt('updated_at', ninetyDaysAgo)

  if (staleError) {
    console.error('[consolidate] Stale cleanup error:', staleError.message)
    stats.errors++
  } else {
    stats.staleRemoved = staleCount ?? 0
  }

  // ---- Step 2: Text-based dedup per namespace --------------------------------

  // Get distinct namespaces
  const { data: allMemories, error: fetchError } = await supabase
    .from('agent_memories')
    .select('id, brand_id, key, value, namespace, memory_type, updated_at')
    .eq('isolation_status', 'active')
    .order('namespace')
    .order('updated_at', { ascending: false })
    .limit(5000)

  if (fetchError) {
    console.error('[consolidate] Fetch error:', fetchError.message)
    return NextResponse.json(
      { error: 'Failed to fetch memories', stats },
      { status: 500 }
    )
  }

  if (!allMemories || allMemories.length === 0) {
    return NextResponse.json({ message: 'No memories to consolidate', stats })
  }

  // Group by exact project plus namespace. A similarly named namespace in a
  // sibling project must not participate in the same learning consolidation.
  const byNamespace = new Map<string, MemoryRow[]>()
  for (const mem of allMemories as MemoryRow[]) {
    const ns = `${mem.brand_id}:${mem.namespace}`
    if (!byNamespace.has(ns)) byNamespace.set(ns, [])
    byNamespace.get(ns)!.push(mem)
  }

  const idsToDelete: string[] = []

  for (const [, memories] of byNamespace) {
    if (memories.length < 4) continue // Need >3 to form a cluster

    // Extract phrases for each memory
    const memPhrases = memories.map((m) => {
      const text =
        typeof m.value === 'string'
          ? m.value
          : JSON.stringify(m.value)
      return { mem: m, phrases: extractPhrases(text) }
    })

    // Find clusters of similar memories (>0.5 Jaccard overlap)
    const visited = new Set<string>()

    for (let i = 0; i < memPhrases.length; i++) {
      if (visited.has(memPhrases[i].mem.id)) continue

      const cluster = [memPhrases[i]]
      visited.add(memPhrases[i].mem.id)

      for (let j = i + 1; j < memPhrases.length; j++) {
        if (visited.has(memPhrases[j].mem.id)) continue
        const overlap = phraseOverlap(
          memPhrases[i].phrases,
          memPhrases[j].phrases
        )
        if (overlap > 0.5) {
          cluster.push(memPhrases[j])
          visited.add(memPhrases[j].mem.id)
        }
      }

      // If cluster > 3, keep the first (most recent due to sort order), delete rest
      if (cluster.length > 3) {
        for (let k = 1; k < cluster.length; k++) {
          idsToDelete.push(cluster[k].mem.id)
        }
      }
    }
  }

  // Batch delete duplicates
  if (idsToDelete.length > 0) {
    // Delete in batches of 100 to avoid query size limits
    for (let i = 0; i < idsToDelete.length; i += 100) {
      const batch = idsToDelete.slice(i, i + 100)
      const { error: delError } = await supabase
        .from('agent_memories')
        .delete()
        .in('id', batch)

      if (delError) {
        console.error('[consolidate] Batch delete error:', delError.message)
        stats.errors++
      } else {
        stats.duplicatesRemoved += batch.length
      }
    }
  }

  console.log('[consolidate] Complete:', stats)
  return NextResponse.json({ message: 'Memory consolidation complete', stats })
}
