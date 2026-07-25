export interface AbeCorpusChunk {
  chunk_id: number
  source: string
  source_category: string
  jurisdiction: string
  corpus_version: string
  section: string | null
  content: string
  similarity: number
}

export interface AbeCorpusCitation {
  chunk_id: number
  source: string
  source_category: string
  jurisdiction: string
  corpus_version: string
  section: string | null
  similarity: number
}

export interface AbeCorpusSearchResult {
  status: 'connected' | 'unconfigured'
  corpusVersion: string | null
  chunks: AbeCorpusChunk[]
  citations: AbeCorpusCitation[]
  warning?: string
}

interface AbeCorpusResponse {
  corpus_version?: unknown
  chunks?: unknown
  citations?: unknown
}

const DEFAULT_ABEAI_BASE = 'https://www.abeai.com.au'
type AbeAiEnv = Record<string, string | undefined>

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asChunk(value: unknown): AbeCorpusChunk | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.chunk_id !== 'number' || typeof row.content !== 'string') return null
  return {
    chunk_id: row.chunk_id,
    source: asString(row.source) ?? 'Unknown source',
    source_category: asString(row.source_category) ?? 'regulatory',
    jurisdiction: asString(row.jurisdiction) ?? 'federal',
    corpus_version: asString(row.corpus_version) ?? 'unknown',
    section: asString(row.section),
    content: row.content.slice(0, 4000),
    similarity: typeof row.similarity === 'number' ? row.similarity : 0,
  }
}

function asCitation(value: unknown): AbeCorpusCitation | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  if (typeof row.chunk_id !== 'number') return null
  return {
    chunk_id: row.chunk_id,
    source: asString(row.source) ?? 'Unknown source',
    source_category: asString(row.source_category) ?? 'regulatory',
    jurisdiction: asString(row.jurisdiction) ?? 'federal',
    corpus_version: asString(row.corpus_version) ?? 'unknown',
    section: asString(row.section),
    similarity: typeof row.similarity === 'number' ? row.similarity : 0,
  }
}

export function getAbeAiConfig(env: AbeAiEnv = process.env): { baseUrl: string; apiKey: string } | null {
  const apiKey = env.ABEAI_API_KEY?.trim()
  if (!apiKey) return null
  const rawBase = env.ABEAI_API_BASE?.trim() || DEFAULT_ABEAI_BASE
  return { baseUrl: rawBase.replace(/\/$/, ''), apiKey }
}

export function buildAbeRegulatoryContext(result: AbeCorpusSearchResult): string {
  if (result.status !== 'connected' || result.chunks.length === 0) return ''
  return result.chunks.slice(0, 8).map((chunk) => {
    const section = chunk.section ? `, section ${chunk.section}` : ''
    return `[Abe AI corpus: ${chunk.source}${section}; ${chunk.source_category}; ${chunk.jurisdiction}; version ${chunk.corpus_version}]\n${chunk.content}`
  }).join('\n\n')
}

export async function searchAbeRegulatoryCorpus(
  question: string,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch; env?: AbeAiEnv } = {},
): Promise<AbeCorpusSearchResult> {
  const config = getAbeAiConfig(options.env)
  if (!config) {
    return {
      status: 'unconfigured',
      corpusVersion: null,
      chunks: [],
      citations: [],
      warning: 'Abe AI regulatory corpus is not configured for this NRS deployment.',
    }
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(`${config.baseUrl}/api/corpus/search`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      question: question.slice(0, 2000),
      scope: 'all_healthcare',
      jurisdictions: ['all', 'federal'],
      limit: 12,
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`Abe AI corpus request failed with HTTP ${response.status}.`)
  }

  const payload = await response.json() as AbeCorpusResponse
  const chunks = Array.isArray(payload.chunks) ? payload.chunks.map(asChunk).filter((chunk): chunk is AbeCorpusChunk => chunk !== null) : []
  const citations = Array.isArray(payload.citations) ? payload.citations.map(asCitation).filter((citation): citation is AbeCorpusCitation => citation !== null) : []

  return {
    status: 'connected',
    corpusVersion: asString(payload.corpus_version),
    chunks,
    citations,
  }
}
