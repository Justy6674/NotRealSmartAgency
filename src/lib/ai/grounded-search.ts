/**
 * Search the web for free, with the answer grounded in what was found.
 *
 * Product verification was running on Perplexity search through the AI Gateway,
 * which bills per search — a recurring cost on every caption that names a
 * product. Gemini's free tier does the same job with Google Search grounding at
 * no cost, which is the whole point of the free-routing rule: check the free
 * tiers before reaching for a paid API.
 *
 * Called with raw fetch rather than a provider package so this adds no
 * dependency, and returns null rather than throwing when unconfigured, so a
 * caller can fall back instead of failing.
 *
 * NOT FOR PATIENT DATA. Google's free tier may train on what is sent to it.
 * Callers must keep health-brand content off this path — see verify_product.
 */

// An alias rather than a pinned version: gemini-2.5-flash was already refusing
// new keys with "no longer available to new users", and a verification path
// that rots is worse than none.
const MODEL = process.env.GEMINI_SEARCH_MODEL ?? 'gemini-flash-latest'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export interface GroundedAnswer {
  text: string
  /** Pages the answer was grounded in, so a verdict can cite rather than assert. */
  sources: string[]
}

/** True when the free tier is configured and usable. */
export function groundedSearchAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY)
}

/**
 * Ask a question and get an answer grounded in live search results.
 * Returns null when no key is configured, so callers can fall back.
 */
export async function groundedSearch(
  question: string,
  env: Record<string, string | undefined> = process.env,
): Promise<GroundedAnswer | null> {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) return null

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: question }] }],
      // Grounding is what makes this worth using: the model searches rather
      // than recalling, and a fabricated product name is exactly a confident
      // recollection.
      tools: [{ google_search: {} }],
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Grounded search failed (${response.status}): ${detail.slice(0, 200)}`)
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> }
    }>
  }

  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? '')
    .join('')
    .trim()

  const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((chunk) => chunk.web?.uri ?? '')
    .filter(Boolean)

  if (!text) throw new Error('Grounded search returned nothing to read')

  return { text, sources }
}
