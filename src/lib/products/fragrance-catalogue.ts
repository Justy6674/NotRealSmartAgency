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
import { scoreAgainstEntry, searchTokens, phoneticSimilarity } from './phonetic'

export interface CatalogueMatch {
  brand: string
  name: string
  concentration: string | null
  scent_family: string | null
  perfumer: string[] | null
}

let cached: SupabaseClient | null = null

/**
 * Why the catalogue cannot be reached, in a form a person can act on.
 *
 * `missing` and `malformed` are different faults with different fixes, and
 * telling them apart is the whole point: a malformed value looks configured
 * from every angle except the one that matters.
 */
export type CatalogueConfigProblem =
  | { ok: true }
  | { ok: false, reason: 'missing', detail: string }
  | { ok: false, reason: 'malformed', detail: string }

/**
 * Check the configuration WITHOUT constructing anything.
 *
 * The old guard tested only that the two variables were non-empty, then handed
 * them to `createClient`, which throws on a value that is not a URL. In
 * production `FRAGRANCE_CATALOGUE_URL` is stored as a Vercel Sensitive value
 * and is not a valid URL, so every verification attempt threw
 * `Invalid supabaseUrl: Must be a valid HTTP or HTTPS URL` — and that raw
 * client error was read out to the owner as the reason his fragrance could not
 * be confirmed.
 *
 * The catalogue holds `Kajal | Aican`. One query answers it. The owner spent
 * an afternoon being told his product could not be verified by a check that
 * had never once been able to run in production.
 */
export function catalogueConfig(
  env: Record<string, string | undefined> = process.env,
): CatalogueConfigProblem {
  const url = env.FRAGRANCE_CATALOGUE_URL?.trim()
  const key = env.FRAGRANCE_CATALOGUE_KEY?.trim()

  if (!url && !key) return { ok: false, reason: 'missing', detail: 'FRAGRANCE_CATALOGUE_URL and FRAGRANCE_CATALOGUE_KEY are not set' }
  if (!url) return { ok: false, reason: 'missing', detail: 'FRAGRANCE_CATALOGUE_URL is not set' }
  if (!key) return { ok: false, reason: 'missing', detail: 'FRAGRANCE_CATALOGUE_KEY is not set' }

  // A value pasted with its surrounding quotes is configured everywhere except
  // where it is parsed, which is exactly how this survived a deploy.
  if (/^["']|["']$/.test(url)) {
    return { ok: false, reason: 'malformed', detail: 'FRAGRANCE_CATALOGUE_URL is wrapped in quotes' }
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, reason: 'malformed', detail: 'FRAGRANCE_CATALOGUE_URL is not a URL' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'malformed', detail: `FRAGRANCE_CATALOGUE_URL uses ${parsed.protocol} — Supabase needs http or https` }
  }

  return { ok: true }
}

/**
 * The catalogue client, or null when it cannot be built.
 *
 * Never throws. A configuration fault here must degrade the answer, never
 * become the answer.
 */
export function catalogueClient(env: Record<string, string | undefined> = process.env): SupabaseClient | null {
  const config = catalogueConfig(env)
  if (!config.ok) {
    console.error(`[fragrance-catalogue] unavailable: ${config.detail}`)
    return null
  }
  if (!cached) {
    try {
      cached = createClient(
        env.FRAGRANCE_CATALOGUE_URL!.trim(),
        env.FRAGRANCE_CATALOGUE_KEY!.trim(),
        { auth: { persistSession: false, autoRefreshToken: false } },
      )
    } catch (error) {
      console.error('[fragrance-catalogue] client construction failed:', error)
      return null
    }
  }
  return cached
}

export function catalogueAvailable(env: Record<string, string | undefined> = process.env): boolean {
  return catalogueConfig(env).ok
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

/**
 * Find candidates by SOUND, not by spelling.
 *
 * The trigram matcher scores "Mulan Cha" against Nishane Wulong Cha at zero —
 * they share almost no letters — and hands back Western Valley Mulan Rouge
 * instead. A different house, a different bottle, and what the owner's own
 * marketing app told him he was wearing.
 *
 * Retrieval works off the words that survived. In a garbled name at least one
 * usually does — "Mulan CHA", "Birredo BLANCHE" — and that word pulls a few
 * hundred rows out of 114,000 cheaply. Sound comparison then does the ranking.
 */
export async function phoneticMatch(
  query: string,
  env: Record<string, string | undefined> = process.env,
): Promise<FuzzyHit[]> {
  const supabase = catalogueClient(env)
  if (!supabase) return []

  const tokens = searchTokens(query)
  if (tokens.length === 0) return []

  const batches = await Promise.all(
    tokens.slice(0, 4).map(async (token) => {
      const [byName, byBrand, byTrigram] = await Promise.all([
        supabase.from('fragrances').select('brand, name, concentration, scent_family, perfumer')
          .ilike('name', `%${token}%`).limit(150),
        // Deliberately generous. A token that matches a HOUSE is the strongest
        // signal there is, and the house's whole range is the search space:
        // capping it at sixty unordered rows is why "Ormond Janes Bijous
        // Saffron" came back with three Ormonde Jaynes and not the one it
        // plainly meant. Bijou Zafran was simply never fetched.
        supabase.from('fragrances').select('brand, name, concentration, scent_family, perfumer')
          .ilike('brand', `%${token}%`).limit(500),
        // And the trigram index per token, because a heard word is often the
        // right word with an extra letter — "Bijous" for Bijou, "Saffron" for
        // Zafran. `ilike` demands the substring be exact; this does not.
        supabase.rpc('search_fragrances_fuzzy', {
          query_text: token, match_threshold: 0.3, max_results: 40,
        }),
      ])
      return [
        ...(byName.data ?? []),
        ...(byBrand.data ?? []),
        ...(Array.isArray(byTrigram.data) ? byTrigram.data : []),
      ]
    }),
  )

  const seen = new Set<string>()
  const hits: FuzzyHit[] = []
  for (const row of batches.flat() as Array<Record<string, unknown>>) {
    const brand = String(row.brand ?? '')
    const name = String(row.name ?? '')
    const key = `${brand}|${name}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const score = scoreAgainstEntry(query, brand, name)
    // Below this the "match" is two names that merely share a common word.
    if (score < 0.5) continue

    hits.push({
      brand,
      name,
      concentration: (row.concentration as string) ?? null,
      scent_family: (row.scent_family as string) ?? null,
      perfumer: (row.perfumer as string[]) ?? null,
      score,
    })
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 8)
}

/**
 * Both matchers, best answer first.
 *
 * Kept separate rather than blended. A trigram score and a sound score measure
 * different things, and averaging them would let a strong letter match on the
 * wrong bottle outvote a strong sound match on the right one — which is
 * exactly the failure being fixed.
 */
export async function bestMatch(
  query: string,
  env: Record<string, string | undefined> = process.env,
): Promise<FuzzyHit[]> {
  const [trigram, phonetic] = await Promise.all([
    fuzzyMatch(query, env).catch(() => []),
    phoneticMatch(query, env).catch(() => []),
  ])

  const byKey = new Map<string, FuzzyHit>()
  for (const hit of [...trigram, ...phonetic]) {
    const key = `${hit.brand}|${hit.name}`.toLowerCase()
    const existing = byKey.get(key)
    if (!existing || hit.score > existing.score) byKey.set(key, hit)
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, 8)
}

/**
 * Resolve "<product> by <house>" by searching inside the house.
 *
 * The transcript said "Mulan Cha by Nishane" — the product mangled beyond
 * recognition and the house perfect. Folded together as one phrase they score
 * worse than either alone, and the answer came back "Nishane Ani Mini".
 *
 * An exactly-matching house is the strongest evidence in the sentence. Used
 * properly it turns 114,000 rows into that house's range — usually under two
 * hundred — where a mangled product name has nothing left to collide with.
 */
export async function matchWithinHouse(
  product: string,
  house: string,
  env: Record<string, string | undefined> = process.env,
): Promise<FuzzyHit[]> {
  const supabase = catalogueClient(env)
  if (!supabase) return []

  // Find the house first. A misheard house is not a house to search inside.
  const { data: brandRows } = await supabase
    .from('fragrances')
    .select('brand')
    .ilike('brand', `%${house.split(/\s+/)[0]}%`)
    .limit(200)

  const houses = [...new Set((brandRows ?? []).map((row) => String(row.brand ?? '')))]
    .map((name) => ({ name, score: phoneticSimilarity(house, name) }))
    .sort((a, b) => b.score - a.score)

  // Below this it is a different house and searching inside it is worse than
  // not searching at all — it would return a confident answer from the wrong
  // brand's catalogue.
  if (houses.length === 0 || houses[0].score < 0.85) return []

  const { data } = await supabase
    .from('fragrances')
    .select('brand, name, concentration, scent_family, perfumer')
    .eq('brand', houses[0].name)
    .limit(600)

  const seen = new Set<string>()
  const hits: FuzzyHit[] = []
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const name = String(row.name ?? '')
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    hits.push({
      brand: houses[0].name,
      name,
      concentration: (row.concentration as string) ?? null,
      scent_family: (row.scent_family as string) ?? null,
      perfumer: (row.perfumer as string[]) ?? null,
      // Scored on the PRODUCT alone. The house is already established, so
      // letting it contribute would flatter every bottle in the range equally.
      score: phoneticSimilarity(product, name),
    })
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 8)
}

/** "Mulan Cha by Nishane" → product and house, or null. */
export function splitByHouse(phrase: string): { product: string; house: string } | null {
  const match = phrase.match(/^(.+?)\s+(?:by|from)\s+(.+)$/i)
  if (!match) return null
  const product = match[1].trim()
  const house = match[2].trim()
  return product && house ? { product, house } : null
}
