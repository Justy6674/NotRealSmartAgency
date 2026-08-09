import { verifyFragrance } from './fragrance-catalogue'

type ProductVerdict = Awaited<ReturnType<typeof verifyFragrance>>

export interface ProductClaimGateResult {
  allowed: boolean
  candidates: string[]
  verified: string[]
  reason?: string
}

const SKIPPED_PHRASES = new Set([
  'scent sell',
  'second hand',
  'australia wide',
  'instagram reels',
  'facebook reels',
  'send us',
  'follow us',
  'your collection',
  'our collection',
  'your fragrance',
  'the fragrance',
])

const LEADING_COPY_WORDS = new Set([
  'a', 'an', 'the', 'discover', 'introducing', 'selling', 'buying', 'shop',
  'browse', 'find', 'message', 'follow', 'australia', 'fragrance', 'perfume',
  'scent', 'bottle', 'today', 'this', 'that', 'our', 'your', 'new', 'arrivals',
  'just', 'landed', 'limited', 'edition', 'finds', 'fresh', 'rare', 'preloved',
  'pre-loved', 'authentic', 'collection', 'available', 'now',
])

function normaliseSlug(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

/**
 * Finds the limited class of title-cased phrases that look like a named
 * product in customer-facing copy. It intentionally ignores normal prose and
 * hashtags: product identity is a high-signal gate, not a generic style lint.
 */
export function extractNamedProductCandidates(text: string): string[] {
  const candidates = new Set<string>()
  const titleCasePhrase = /\b(?:[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]*\s+){1,5}[A-Z][A-Za-zÀ-ÖØ-öø-ÿ'’-]*\b/g

  for (const match of text.matchAll(titleCasePhrase)) {
    let phrase = match[0].replace(/\s+/g, ' ').trim()
    const words = phrase.split(' ')
    while (words.length > 1 && LEADING_COPY_WORDS.has(words[0].toLowerCase())) words.shift()
    phrase = words.join(' ')
    if (phrase.split(' ').length < 2) continue
    if (SKIPPED_PHRASES.has(phrase.toLowerCase())) continue
    candidates.add(phrase)
  }

  return [...candidates]
}

function escapesForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Avoid treating every capitalised campaign heading or house name as a bottle. */
function hasExplicitProductClaim(text: string, candidate: string): boolean {
  const escaped = escapesForRegex(candidate)
  const directMention = new RegExp(
    `(?:discover|introducing|featuring|wearing|trying|reviewing|listing|selling|buying)\\s+(?:the\\s+)?${escaped}\\b`,
    'i',
  )
  if (directMention.test(text)) return true
  if (text.includes(`"${candidate}"`) || text.includes(`“${candidate}”`)) return true

  const match = new RegExp(escaped, 'i').exec(text)
  if (!match || match.index === undefined) return false
  const nearby = text.slice(Math.max(0, match.index - 36), match.index + candidate.length + 48)
  return /\b(?:bottle|fragrance|perfume|cologne|for sale|in stock|now stock|available to buy)\b/i.test(nearby)
}

/**
 * Customer-facing ScentSell content can mention a named fragrance only when
 * the owner's catalogue proves the name. This is a publishing boundary, not a
 * prompt preference: an unavailable catalogue or a near match blocks the
 * named claim and leaves generic product discussion available.
 */
export async function validateScentSellProductClaims(
  brandSlug: string,
  text: string,
  verify: (candidate: string) => Promise<ProductVerdict> = verifyFragrance,
): Promise<ProductClaimGateResult> {
  if (normaliseSlug(brandSlug) !== 'scentsell') return { allowed: true, candidates: [], verified: [] }

  const candidates = extractNamedProductCandidates(text)
    .filter((candidate) => hasExplicitProductClaim(text, candidate))
  if (candidates.length === 0) return { allowed: true, candidates, verified: [] }

  const verified: string[] = []
  for (const candidate of candidates) {
    const result = await verify(candidate)
    if (result.verdict !== 'exists') {
      const suggestion = result.verdict === 'not_found' && result.near[0]
        ? ` Nearest catalogue result: ${result.near[0].brand} ${result.near[0].name}.`
        : ''
      return {
        allowed: false,
        candidates,
        verified,
        reason: `ScentSell product identity gate blocked the named claim "${candidate}" because it was not confirmed by the fragrance catalogue.${suggestion} Use generic wording or verify the exact product with the owner before saving or publishing.`,
      }
    }
    verified.push(result.canonical)
  }

  return { allowed: true, candidates, verified }
}
