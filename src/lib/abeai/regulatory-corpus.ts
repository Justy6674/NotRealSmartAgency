/**
 * NRS → Abe AI regulatory corpus client.
 *
 * Abe AI is Justin's own AHPRA/TGA corpus service, and NRS is a FIRST-PARTY
 * consumer of it: it grounds its own internal compliance review and never
 * republishes what comes back to a paying subscriber. Abe AI's verified-citation
 * path exists to protect that republication case, and it is fail-closed — every
 * corpus row is `rights_projection = unknown` until a reviewed backfill
 * classifies it, so the verified path can only ever return nothing for us.
 *
 * That is why this client asks for `citation_mode: 'first_party_grounding'`.
 * It buys the corpus TEXT without the rights gate, on the explicit condition
 * that the text is labelled as grounding material and never dressed up as a
 * verified citation. `verification` on the result carries that label, and
 * buildAbeRegulatoryContext() states it in the model's own context — a type
 * the model never sees is not a safeguard.
 */

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

/**
 * `connected` used to be the only success value, which made "Abe AI answered
 * with nothing" indistinguishable from "the review is grounded in the current
 * rules". On the first-party path that is now the LIKELY failure mode — a
 * retrieval that matches no chunks returns HTTP 200 with an empty array, not an
 * error — so it gets its own state and the caller can no longer miss it.
 */
export type AbeCorpusStatus = 'connected' | 'no_grounding' | 'unconfigured'

/**
 * Whether the returned material may be treated as a verified primary-source
 * citation. `unknown` means Abe AI did not say, and an unlabelled answer must
 * be handled exactly as an unverified one — never optimistically.
 */
export type AbeCorpusVerification = 'verified' | 'first_party_unverified' | 'unknown'

export interface AbeCorpusSearchResult {
  status: AbeCorpusStatus
  verification: AbeCorpusVerification
  corpusVersion: string | null
  chunks: AbeCorpusChunk[]
  citations: AbeCorpusCitation[]
  warning?: string
}

interface AbeCorpusResponse {
  corpus_version?: unknown
  chunks?: unknown
  citations?: unknown
  constraints?: unknown
  warnings?: unknown
}

const DEFAULT_ABEAI_BASE = 'https://www.abeai.com.au'

/** Abe AI's request-side flag. Verified citations are for its subscribers; NRS is not one. */
const FIRST_PARTY_CITATION_MODE = 'first_party_grounding'

/**
 * A failing platform returns an HTML error page, not JSON. Enough of it to
 * diagnose, not enough to paste a whole page into a compliance warning.
 */
const MAX_ERROR_DETAIL = 500

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

/**
 * Abe AI states the honesty of a response in `constraints.citation_status`.
 * Anything we do not recognise — an older Abe AI deploy that ignored
 * `citation_mode`, a proxy that stripped the block — is `unknown`, which this
 * client treats as unverified. Inferring "verified" from a missing field is
 * exactly the mistake the field exists to prevent.
 */
function readVerification(payload: AbeCorpusResponse): AbeCorpusVerification {
  if (!payload.constraints || typeof payload.constraints !== 'object') return 'unknown'
  const status = asString((payload.constraints as Record<string, unknown>).citation_status)
  if (status === 'verified_primary_source') return 'verified'
  if (status === 'unverified_first_party') return 'first_party_unverified'
  return 'unknown'
}

/**
 * Abe AI's own warning codes (NO_CORPUS_MATCH, limit-capped notices). Carried
 * through because "returned nothing" and "returned nothing AND told us why"
 * are different diagnoses, and only one of them is actionable.
 */
function readServerWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(asString)
    .filter((warning): warning is string => warning !== null)
    .slice(0, 4)
}

const VERIFICATION_LABELS: Record<AbeCorpusVerification, string> = {
  verified:
    '[Abe AI regulatory corpus — VERIFIED primary-source material. Treat these sources as the authority and name the source when flagging an issue.]',
  first_party_unverified:
    '[Abe AI regulatory corpus — FIRST-PARTY GROUNDING ONLY. This is current Australian regulatory text retrieved for internal review. It has NOT passed Abe AI\'s verified-citation check, so reason from it and name the source in your reasoning, but do not present any of it as a verified or quotable citation, and do not reproduce it in published copy.]',
  unknown:
    '[Abe AI regulatory corpus — VERIFICATION UNKNOWN. Abe AI did not label this material, so treat it exactly as unverified first-party grounding: reason from it, never present it as a verified citation.]',
}

export function getAbeAiConfig(env: AbeAiEnv = process.env): { baseUrl: string; apiKey: string } | null {
  const apiKey = env.ABEAI_API_KEY?.trim()
  if (!apiKey) return null
  const rawBase = env.ABEAI_API_BASE?.trim() || DEFAULT_ABEAI_BASE
  return { baseUrl: rawBase.replace(/\/$/, ''), apiKey }
}

export function buildAbeRegulatoryContext(result: AbeCorpusSearchResult): string {
  if (result.status !== 'connected' || result.chunks.length === 0) return ''
  const body = result.chunks.slice(0, 8).map((chunk) => {
    const section = chunk.section ? `, section ${chunk.section}` : ''
    return `[Abe AI corpus: ${chunk.source}${section}; ${chunk.source_category}; ${chunk.jurisdiction}; version ${chunk.corpus_version}]\n${chunk.content}`
  }).join('\n\n')
  // The label leads, because a compliance model reads top-down and the standing
  // instruction it follows ("treat these sources as the authority") is the line
  // immediately above this block.
  return `${VERIFICATION_LABELS[result.verification]}\n\n${body}`
}

export async function searchAbeRegulatoryCorpus(
  question: string,
  options: { signal?: AbortSignal; fetchImpl?: typeof fetch; env?: AbeAiEnv } = {},
): Promise<AbeCorpusSearchResult> {
  const config = getAbeAiConfig(options.env)
  if (!config) {
    return {
      status: 'unconfigured',
      verification: 'unknown',
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
      citation_mode: FIRST_PARTY_CITATION_MODE,
      // Sent explicitly even though Abe AI defaults it to true. First-party
      // grounding relaxes the RIGHTS gate, never the CURRENCY gate — a
      // superseded standard is worse than no standard on a compliance path,
      // and Abe AI refuses historical search on an API key regardless.
      current_only: true,
    }),
    signal: options.signal,
  })

  // Read the body once, before branching. `response.json()` on a failure gives
  // a SyntaxError about the HTML it could not parse, which is a worse diagnosis
  // than the HTML itself.
  const raw = await response.text()

  if (!response.ok) {
    // FAULT (15–17 Aug 2026): this threw `Abe AI corpus request failed with
    // HTTP ${status}.` and dropped the body, so two days of hard 500s — Abe AI
    // switched retrieval to match_verified_regulatory_corpus* RPCs whose
    // migration was never applied to its production database — reached the
    // compliance warnings as a bare status code with nothing to act on. Abe AI
    // is our own service, so its error text is ours to read; withholding it
    // protected nobody and cost two days.
    throw new Error(`Abe AI corpus request failed with HTTP ${response.status}: ${errorDetail(raw)}`)
  }

  let payload: AbeCorpusResponse
  try {
    payload = JSON.parse(raw) as AbeCorpusResponse
  } catch {
    // A 200 that is not JSON is an edge or proxy answering instead of Abe AI.
    // Same reasoning as above: say what actually came back.
    throw new Error(`Abe AI corpus returned HTTP 200 with a non-JSON body: ${errorDetail(raw)}`)
  }

  const chunks = Array.isArray(payload.chunks) ? payload.chunks.map(asChunk).filter((chunk): chunk is AbeCorpusChunk => chunk !== null) : []
  const citations = Array.isArray(payload.citations) ? payload.citations.map(asCitation).filter((citation): citation is AbeCorpusCitation => citation !== null) : []
  const verification = readVerification(payload)
  const corpusVersion = asString(payload.corpus_version)
  const serverWarnings = readServerWarnings(payload.warnings)
  const reported = serverWarnings.length ? ` Abe AI reported: ${serverWarnings.join('; ')}.` : ''

  if (chunks.length === 0) {
    return {
      status: 'no_grounding',
      verification,
      corpusVersion,
      chunks,
      citations,
      warning: `Abe AI's regulatory corpus was reachable but returned no matching AHPRA/TGA material, so this review is not grounded in the current rules.${reported}`,
    }
  }

  return {
    status: 'connected',
    verification,
    corpusVersion,
    chunks,
    citations,
    // No warning on the expected first-party path — that label belongs in the
    // model's context, not in a risk list the owner cannot act on. An UNLABELLED
    // answer is different: it means Abe AI did not tell us what it gave us.
    ...(verification === 'unknown'
      ? {
          warning:
            'Abe AI did not state whether the returned regulatory material is a verified citation or first-party grounding text; it has been treated as unverified.',
        }
      : {}),
  }
}

/** Bounded, whitespace-collapsed error text: enough to diagnose, not a whole HTML page. */
function errorDetail(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return '(empty response body)'
  try {
    const parsed = JSON.parse(trimmed) as unknown
    const message = parsed && typeof parsed === 'object'
      ? asString((parsed as Record<string, unknown>).error)
      : null
    if (message) return message.slice(0, MAX_ERROR_DETAIL)
  } catch {
    // Not JSON — fall through and report the raw text.
  }
  const collapsed = trimmed.replace(/\s+/g, ' ')
  return collapsed.length > MAX_ERROR_DETAIL ? `${collapsed.slice(0, MAX_ERROR_DETAIL)}…` : collapsed
}
