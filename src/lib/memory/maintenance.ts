import type { SupabaseClient } from '@supabase/supabase-js'
import { embedTextDetailed } from './embeddings'

const DEFAULT_BATCH_SIZE = 25
const MAX_BATCH_SIZE = 50

export interface MemoryMaintenanceStats {
  processed: number
  embedded: number
  retryable: number
  candidates: number
  cursor: string | null
}

interface MemoryRow {
  id: string
  value: string | Record<string, unknown>
  key: string
  namespace: string
  brand_id: string
  memory_type: string | null
  updated_at: string
}

function textOf(value: string | Record<string, unknown>): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function extractPhrases(text: string): Set<string> {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2)
  const phrases = new Set<string>()
  for (let index = 0; index <= words.length - 3; index++) phrases.add(words.slice(index, index + 3).join(' '))
  return phrases
}

function phraseOverlap(left: Set<string>, right: Set<string>): number {
  if (!left.size || !right.size) return 0
  let intersection = 0
  for (const phrase of left) if (right.has(phrase)) intersection++
  return intersection / (left.size + right.size - intersection)
}

export function nextMaintenanceStatus(
  processed: number,
  batchSize: number,
): 'partial' | 'completed' {
  return processed >= batchSize ? 'partial' : 'completed'
}

async function createOrResumeRun(
  supabase: SupabaseClient,
  jobType: 'embedding_backfill' | 'consolidation',
): Promise<{ id: string; cursor: string | null; statistics: Partial<MemoryMaintenanceStats> } | null> {
  const { data: existing } = await supabase
    .from('memory_maintenance_runs')
    .select('id, cursor, statistics')
    .eq('job_type', jobType)
    .in('status', ['running', 'partial'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const cursor = (existing.cursor as Record<string, unknown> | null)?.last_id
    return {
      id: existing.id as string,
      cursor: typeof cursor === 'string' ? cursor : null,
      statistics: (existing.statistics ?? {}) as Partial<MemoryMaintenanceStats>,
    }
  }

  const { data, error } = await supabase
    .from('memory_maintenance_runs')
    .insert({ job_type: jobType, status: 'running' })
    .select('id, cursor, statistics')
    .single()
  if (error || !data?.id) return null
  return { id: data.id as string, cursor: null, statistics: {} }
}

async function settleRun(
  supabase: SupabaseClient,
  id: string,
  status: 'partial' | 'completed' | 'failed',
  statistics: MemoryMaintenanceStats,
): Promise<void> {
  await supabase
    .from('memory_maintenance_runs')
    .update({
      status,
      cursor: statistics.cursor ? { last_id: statistics.cursor } : {},
      statistics,
      ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)
}

/**
 * Bounded, resumable vector repair. It updates only missing embeddings; every
 * failed provider call remains null so a later maintenance run can retry it.
 */
export async function backfillMemoryEmbeddings(
  supabase: SupabaseClient,
  options: { batchSize?: number } = {},
): Promise<{ runId: string | null; status: 'partial' | 'completed' | 'failed'; stats: MemoryMaintenanceStats }> {
  const batchSize = Math.min(Math.max(options.batchSize ?? DEFAULT_BATCH_SIZE, 1), MAX_BATCH_SIZE)
  const run = await createOrResumeRun(supabase, 'embedding_backfill')
  const zero: MemoryMaintenanceStats = { processed: 0, embedded: 0, retryable: 0, candidates: 0, cursor: null }
  if (!run) return { runId: null, status: 'failed', stats: zero }

  let query = supabase
    .from('agent_memories')
    .select('id, value, key, namespace, brand_id, memory_type, updated_at')
    .eq('isolation_status', 'active')
    .is('embedding', null)
    .order('id', { ascending: true })
    .limit(batchSize)
  if (run.cursor) query = query.gt('id', run.cursor)
  const { data, error } = await query
  if (error) {
    await settleRun(supabase, run.id, 'failed', zero)
    return { runId: run.id, status: 'failed', stats: zero }
  }

  const rows = (data ?? []) as MemoryRow[]
  const stats: MemoryMaintenanceStats = {
    processed: rows.length,
    embedded: 0,
    retryable: 0,
    candidates: rows.length,
    cursor: rows.at(-1)?.id ?? null,
  }
  for (const row of rows) {
    const outcome = await embedTextDetailed(textOf(row.value))
    if (!outcome.embedding.length) {
      stats.retryable++
      continue
    }
    const { error: updateError } = await supabase
      .from('agent_memories')
      .update({ embedding: outcome.embedding })
      .eq('id', row.id)
      .is('embedding', null)
    if (updateError) stats.retryable++
    else stats.embedded++
  }

  const status = nextMaintenanceStatus(rows.length, batchSize)
  await settleRun(supabase, run.id, status, stats)
  return { runId: run.id, status, stats }
}

/**
 * Non-destructive consolidation preview. Previous code deleted conversation
 * rows and duplicate candidates, then stopped after 5,000 rows. This scans a
 * cursor page, records what needs review, and never mutates memory content.
 */
export async function previewMemoryConsolidation(
  supabase: SupabaseClient,
  options: { batchSize?: number } = {},
): Promise<{ runId: string | null; status: 'partial' | 'completed' | 'failed'; stats: MemoryMaintenanceStats }> {
  const batchSize = Math.min(Math.max(options.batchSize ?? 250, 1), 500)
  const run = await createOrResumeRun(supabase, 'consolidation')
  const zero: MemoryMaintenanceStats = { processed: 0, embedded: 0, retryable: 0, candidates: 0, cursor: null }
  if (!run) return { runId: null, status: 'failed', stats: zero }

  let query = supabase
    .from('agent_memories')
    .select('id, value, key, namespace, brand_id, memory_type, updated_at')
    .eq('isolation_status', 'active')
    .order('id', { ascending: true })
    .limit(batchSize)
  if (run.cursor) query = query.gt('id', run.cursor)
  const { data, error } = await query
  if (error) {
    await settleRun(supabase, run.id, 'failed', zero)
    return { runId: run.id, status: 'failed', stats: zero }
  }

  const rows = (data ?? []) as MemoryRow[]
  const byScope = new Map<string, Array<{ row: MemoryRow; phrases: Set<string> }>>()
  for (const row of rows) {
    const scope = `${row.brand_id}:${row.namespace}`
    const current = byScope.get(scope) ?? []
    current.push({ row, phrases: extractPhrases(textOf(row.value)) })
    byScope.set(scope, current)
  }

  let candidates = 0
  for (const memories of byScope.values()) {
    for (let left = 0; left < memories.length; left++) {
      for (let right = left + 1; right < memories.length; right++) {
        if (phraseOverlap(memories[left].phrases, memories[right].phrases) > 0.5) candidates++
      }
    }
  }

  const stats: MemoryMaintenanceStats = {
    processed: rows.length,
    embedded: 0,
    retryable: 0,
    candidates,
    cursor: rows.at(-1)?.id ?? null,
  }
  const status = nextMaintenanceStatus(rows.length, batchSize)
  await settleRun(supabase, run.id, status, stats)
  return { runId: run.id, status, stats }
}
