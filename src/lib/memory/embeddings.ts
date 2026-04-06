import { embed } from 'ai'
import { openai } from '@ai-sdk/openai'

// ---------------------------------------------------------------------------
// Embedding client for memory v2
//
// Uses OpenAI text-embedding-3-small (1536 dims) via AI SDK.
// Simple LRU cache (Map, 100 entries max) to avoid re-embedding identical strings.
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = 'text-embedding-3-small'
const CACHE_MAX = 100

const cache = new Map<string, number[]>()

function cacheSet(key: string, value: number[]): void {
  // Evict oldest entry if cache is full
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, value)
}

/**
 * Embed a single text string into a 1536-dimensional vector.
 * Returns an empty array on failure (never throws).
 */
export async function embedText(text: string): Promise<number[]> {
  const trimmed = text.trim()
  if (!trimmed) return []

  // Check cache
  const cached = cache.get(trimmed)
  if (cached) return cached

  try {
    const { embedding } = await embed({
      model: openai.embedding(EMBEDDING_MODEL),
      value: trimmed,
    })

    cacheSet(trimmed, embedding)
    return embedding
  } catch (err) {
    console.error('[memory/v2] embedText failed:', err)
    return []
  }
}

/**
 * Embed multiple texts in sequence (AI SDK embed does not support batch natively).
 * Returns an array of embeddings in the same order as inputs.
 * Individual failures return empty arrays for that index.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = []

  for (const text of texts) {
    const embedding = await embedText(text)
    results.push(embedding)
  }

  return results
}
