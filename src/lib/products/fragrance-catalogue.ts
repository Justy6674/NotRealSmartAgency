/**
 * The owner's own fragrance catalogue — 75,000 entries, free, authoritative.
 *
 * This exists because every other way of checking a product name got it wrong.
 * A transcript garbled a fragrance as "Ormond Janes, Bijous, Saffron". A web
 * search could not confirm it. Reasoning about it produced "Bijou Saffron",
 * which is not a product. The catalogue answered in one query: Ormonde Jayne
 * **Bijou Zafran**, perfumer Élodie Bernard — real, and spelled with the Arabic
 * Z, which is exactly why searching "saffron" never found it.
 *
 * Read-only, via the publishable key. No catalogue write is possible here and
 * none is wanted: NRS reads product truth, it does not own it.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface CatalogueMatch {
  brand: string
  name: string
  concentration: string | null
  scent_family: string | null
  perfumer: string[] | null
}

let cached: SupabaseClient | null = null

/** The catalogue client, or null when NRS has not been given access. */
export function catalogueClient(env: Record<string, string | undefined> = process.env): SupabaseClient | null {
  const url = env.FRAGRANCE_CATALOGUE_URL
  const key = env.FRAGRANCE_CATALOGUE_KEY
  if (!url || !key) return null
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  }
  return cached
}

export function catalogueAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.FRAGRANCE_CATALOGUE_URL && env.FRAGRANCE_CATALOGUE_KEY)
}

/**
 * Normalise the spellings speech-to-text and English habit get wrong.
 *
 * "Zafran" and "Saffron" are the same word; a transcript will pick one and a
 * writer will "correct" it to the other. Searching only what was heard misses
 * the product entirely — which is precisely how a real fragrance got called an
 * invention.
 */
export function spellingVariants(term: string): string[] {
  const lower = term.toLowerCase()
  const swaps: Array<[RegExp, string]> = [
    [/zafran/g, 'saffron'],
    [/saffron/g, 'zafran'],
    [/oudh?/g, 'oud'],
    [/\bal\s+/g, 'al-'],
  ]
  const out = new Set<string>([term])
  for (const [pattern, replacement] of swaps) {
    if (pattern.test(lower)) out.add(lower.replace(pattern, replacement))
  }
  return [...out]
}

/**
 * Look a product up, tolerating the spelling the speaker actually used.
 *
 * Tries the whole phrase, then each word, so "Ormonde Jayne Bijou Zafran"
 * resolves even when the brand and product are run together.
 */
export async function findFragrance(
  query: string,
  env: Record<string, string | undefined> = process.env,
): Promise<CatalogueMatch[]> {
  const supabase = catalogueClient(env)
  if (!supabase) return []

  const select = 'brand, name, concentration, scent_family, perfumer'
  const seen = new Map<string, CatalogueMatch>()

  const terms = spellingVariants(query)
  const words = terms
    .flatMap((term) => term.split(/\s+/))
    .filter((word) => word.length >= 4)  // query terms only; short ones match everything

  // Gather from every angle before judging. Stopping at the first hit made
  // "Ormonde Jayne Bijou Zafran" match "Ormonde Man" — the house name is the
  // LEAST distinctive part of the query, and it is the part that matches first.
  for (const candidate of [...terms, ...words]) {
    const { data } = await supabase
      .from('fragrances')
      .select(select)
      .ilike('name', `%${candidate}%`)
      .limit(25)

    for (const row of data ?? []) {
      seen.set(`${row.brand}|${row.name}`, row as CatalogueMatch)
    }
  }

  return rankMatches(query, [...seen.values()])
}

/** Words too common to tell two fragrances apart. */
const WEAK_WORDS = new Set(['eau', 'parfum', 'edp', 'edt', 'extrait', 'the', 'de', 'la', 'le'])

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 2 && !WEAK_WORDS.has(word))
}

/**
 * Rank by how much of the candidate's NAME the query actually accounts for.
 *
 * A house with 40 products will match on its own name alone, which is worse
 * than useless — it returns a confident wrong answer. Scoring on the product
 * name, and only then rewarding a brand match, puts "Bijou Zafran" above
 * "Ormonde Man".
 */
export function rankMatches(query: string, matches: CatalogueMatch[]): CatalogueMatch[] {
  const wanted = new Set([...tokens(query), ...spellingVariants(query).flatMap(tokens)])

  return matches
    .map((row) => {
      const brandTokens = new Set(tokens(row.brand))
      const nameTokens = tokens(row.name)

      // Only words the PRODUCT name adds beyond its own house count. Ormonde
      // Jayne sells a fragrance called "Ormonde"; matching that on the word
      // "Ormonde" is matching the brand twice, and it outranked the real
      // answer until this was excluded.
      const distinctive = [...new Set(nameTokens.filter((word) => !brandTokens.has(word)))]
      const covered = distinctive.filter((word) => wanted.has(word))

      const brandMatch = [...brandTokens].some((word) => wanted.has(word)) ? 3 : 0
      const unexplained = distinctive.length - covered.length

      return {
        row,
        covered: covered.length,
        brandMatch: brandMatch > 0,
        distinctive: distinctive.length,
        // Two distinctive words beat one; agreeing on the house is strong
        // evidence; words the query never mentioned are evidence against, which
        // is what stops a long "Inspired by X" knock-off outranking the real X.
        score: covered.length * 2 + brandMatch - unexplained * 1.5,
      }
    })
    // A candidate that shares no distinctive word with the query is noise.
    .filter((entry) => entry.covered > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.row)
}

/**
 * Above this, the catalogue and the query are talking about the same bottle.
 * Below it, a hit is a candidate to put to the owner, not an answer.
 */
const CONFIDENT = 0.75
const WORTH_SUGGESTING = 0.3

export interface FuzzyHit extends CatalogueMatch {
  score: number
}

/**
 * Sniffopotamus's own trigram matcher, `search_fragrances_fuzzy`.
 *
 * This is what should have been used from the start. Given the raw garbled
 * transcript "Ormond Janes Bijous Saffron" it returns Ormonde Jayne Bijou
 * Zafran — the correct product — where a web search found nothing and reasoning
 * invented "Bijou Saffron". The owner already built the right tool; NRS was
 * simply not asking it.
 */
export async function fuzzyMatch(
  query: string,
  env: Record<string, string | undefined> = process.env,
): Promise<FuzzyHit[]> {
  const supabase = catalogueClient(env)
  if (!supabase) return []

  const { data, error } = await supabase.rpc('search_fragrances_fuzzy', {
    query_text: query,
    match_threshold: WORTH_SUGGESTING,
    max_results: 8,
  })
  if (error || !Array.isArray(data)) return []

  const seen = new Set<string>()
  const hits: FuzzyHit[] = []
  for (const row of data as Array<Record<string, unknown>>) {
    const key = `${row.brand}|${row.name}`
    if (seen.has(key)) continue // the RPC can return a bottle twice
    seen.add(key)
    hits.push({
      brand: String(row.brand ?? ''),
      name: String(row.name ?? ''),
      concentration: (row.concentration as string) ?? null,
      scent_family: (row.scent_family as string) ?? null,
      perfumer: (row.perfumer as string[]) ?? null,
      score: Number(row.similarity_score ?? row.match_score ?? 0),
    })
  }
  return hits.sort((a, b) => b.score - a.score)
}

/**
 * Does this product exist, and under what spelling?
 *
 * `exists` means the catalogue holds it. `not_found` means 75,000 entries do
 * not, which for a fragrance is close to proof. Never a guess either way.
 */
export async function verifyFragrance(
  productName: string,
  env: Record<string, string | undefined> = process.env,
): Promise<
  | { verdict: 'exists'; canonical: string; match: CatalogueMatch }
  | { verdict: 'not_found'; near: CatalogueMatch[] }
  | { verdict: 'unavailable' }
> {
  if (!catalogueAvailable(env)) return { verdict: 'unavailable' }

  // The owner's own trigram matcher answers first — it is the only thing that
  // resolved the garbled transcript correctly.
  const fuzzy = await fuzzyMatch(productName, env)
  if (fuzzy.length > 0) {
    const top = fuzzy[0]
    if (top.score >= CONFIDENT) {
      const hasBrand = top.name.toLowerCase().includes(top.brand.toLowerCase())
      return {
        verdict: 'exists',
        canonical: (hasBrand ? top.name : `${top.brand} ${top.name}`).trim(),
        match: top,
      }
    }
    // A weak hit is a candidate to put to the owner, never a name to publish.
    return { verdict: 'not_found', near: fuzzy.slice(0, 5) }
  }

  const matches = await findFragrance(productName, env)
  if (matches.length === 0) return { verdict: 'not_found', near: [] }

  // findFragrance already ranked these; the top one is the best explanation of
  // what was asked for.
  const best = matches[0]
  const askedTokens = new Set([
    ...tokens(productName),
    ...spellingVariants(productName).flatMap(tokens),
  ])
  const brandTokens = new Set(tokens(best.brand))
  // Judge on the words the product name adds beyond its house, for the same
  // reason the ranking does.
  const distinctive = [...new Set(tokens(best.name).filter((word) => !brandTokens.has(word)))]
  const nameFullyAccountedFor =
    distinctive.length > 0 && distinctive.every((word) => askedTokens.has(word))

  // A partial name match is a near miss, not a confirmation. "Bijou Saffron"
  // must NOT come back as confirmed just because "Bijou Zafran" exists — the
  // owner needs to be told the real spelling, not handed a false yes.
  // One common word is not a confirmation. "Totally Made Up Perfume XYZ"
  // shares "made" with "Bruno Banani Made" and means nothing by it, so a
  // single-word match must also agree on the house.
  const brandAgrees = [...brandTokens].some((word) => askedTokens.has(word))
  const enoughEvidence = brandAgrees || distinctive.length >= 2

  if (!nameFullyAccountedFor || !enoughEvidence) {
    return { verdict: 'not_found', near: matches.slice(0, 5) }
  }

  // Some rows already carry the house inside the product name, so blindly
  // prefixing it produced "Byredo Black Saffron Byredo".
  const nameHasBrand = best.name.toLowerCase().includes(best.brand.toLowerCase())
  return {
    verdict: 'exists',
    canonical: (nameHasBrand ? best.name : `${best.brand} ${best.name}`).trim(),
    match: best,
  }
}
