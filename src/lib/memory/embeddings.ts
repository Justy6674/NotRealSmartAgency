import { embed } from 'ai'
import { gateway } from '@ai-sdk/gateway'

// ---------------------------------------------------------------------------
// Embedding client for memory v2
//
// Routed through the Vercel AI Gateway, which is already configured for every
// other model call here. That is the point: the old client called OpenAI
// directly and needed OPENAI_API_KEY, which was never set — so every embed
// threw, silently, on every request. 7,074 memories were stored with no vector
// at all and nothing could ever be recalled by meaning.
//
// Nothing was migrated to make this change: not one row had an embedding, so
// there were no vectors from another model to be incompatible with. Two models
// do not share a vector space even at identical width, so if that ever stops
// being true, changing model means re-embedding every row, not just editing
// this constant.
// ---------------------------------------------------------------------------

/**
 * `agent_memories.embedding` is `vector(1536)` and Postgres rejects anything
 * else, so the width is a contract, not a preference. Gemini is natively 3072
 * and is asked for 1536; the assertion below is what stops a model change
 * quietly writing nothing again.
 */
export const EMBEDDING_DIMENSIONS = 1536

const EMBEDDING_MODEL = process.env.NRS_EMBEDDING_MODEL ?? 'google/gemini-embedding-001'
const CACHE_MAX = 100

const cache = new Map<string, number[]>()

export interface EmbeddingOutcome {
  embedding: number[]
  /** A stable, non-secret diagnostic for resumable maintenance jobs. */
  errorCode?: 'empty_input' | 'dimension_mismatch' | 'provider_unavailable'
}

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
export async function embedTextDetailed(text: string): Promise<EmbeddingOutcome> {
  const trimmed = text.trim()
  if (!trimmed) return { embedding: [], errorCode: 'empty_input' }

  // Check cache
  const cached = cache.get(trimmed)
  if (cached) return { embedding: cached }

  try {
    const { embedding } = await embed({
      model: gateway.textEmbeddingModel(EMBEDDING_MODEL),
      value: trimmed,
      providerOptions: {
        // Gemini is Matryoshka — it can be truncated to a narrower width
        // without retraining, which is what lets it meet the column.
        google: { outputDimensionality: EMBEDDING_DIMENSIONS },
      },
    })

    // A wrong width is not a smaller answer, it is an unusable one: the insert
    // would be rejected and the memory stored blind, exactly as before.
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      console.error(
        `[memory/v2] ${EMBEDDING_MODEL} returned ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS} — refusing to store`,
      )
      return { embedding: [], errorCode: 'dimension_mismatch' }
    }

    cacheSet(trimmed, embedding)
    return { embedding }
  } catch (err) {
    console.error('[memory/v2] embedText failed:', err)
    return { embedding: [], errorCode: 'provider_unavailable' }
  }
}

/** Embed a single text string, preserving the legacy empty-array contract. */
export async function embedText(text: string): Promise<number[]> {
  return (await embedTextDetailed(text)).embedding
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
