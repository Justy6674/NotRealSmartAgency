/**
 * Resolve the product names a transcript THINKS it heard.
 *
 * "You've layered Mulan Cha and Birredo Blanche" went out under the owner's
 * own brand. Byredo is one of the best-known houses in fragrance and the app
 * that exists to market a fragrance marketplace could not spell it.
 *
 * The catalogue always knew. Ask it "Birredo Blanche" and its own trigram
 * matcher returns Byredo Blanche as the top hit. Two things stopped that from
 * helping:
 *
 *   1. The video-to-draft writer had NO TOOLS. It was handed a raw transcript
 *      and asked to write copy, so there was nothing in the loop that could
 *      have checked a name even in principle. Adding an instruction to "call
 *      verify_product" would not have helped — there was no tool to call.
 *   2. `verifyFragrance` scores "Birredo Blanche" at 0.61 and calls that
 *      not_found. For a typed query that caution is right. For a transcript it
 *      is not: speech-to-text mangles proper nouns by definition, so a near
 *      miss is the EXPECTED shape of a correct answer.
 *
 * So this runs before a word of copy is written, deterministically, and hands
 * the writer three lists: names it may use, names it must ask about, and names
 * it must not write at all. A caption with one fewer product name is fixable.
 * A caption that misspells Byredo is what the owner's customers see.
 */

import { bestMatch, catalogueAvailable, type FuzzyHit } from './fragrance-catalogue'
import { fold } from './phonetic'

/**
 * Good enough to correct silently.
 *
 * Set where sound-matching makes it safe and no lower. "Birredo Blanche"
 * folds to exactly the same sounds as Byredo Blanche and scores 1.00; "Ormond
 * Janes Bijous Saffron" scores 0.91 against Ormonde Jayne Bijou Zafran and
 * runs 0.24 clear of anything else. Both of those are certain enough to fix
 * without asking.
 *
 * "Mulan Cha" scores 0.75 against Nishane Wulong Cha — the right answer, and
 * top of the list — but only 0.08 clear of Mulan Rouge, a different house.
 * That is a question, not a correction. Writing the wrong bottle confidently
 * is the failure being fixed; writing nothing and asking is not.
 */
export const CORRECT_SILENTLY = 0.85
/** Worth putting to the owner as a question, never worth publishing. */
export const WORTH_ASKING = 0.34

/**
 * How far clear the best hit must be of the next DIFFERENT product.
 *
 * Two products scoring the same means the transcript is genuinely ambiguous,
 * and picking the alphabetically-luckier one is how you confidently publish
 * the wrong bottle.
 */
export const REQUIRED_MARGIN = 0.1

/** Words that start a sentence and are not a fragrance house. */
const SENTENCE_STARTERS = new Set([
  'i', 'we', 'you', 'he', 'she', 'it', 'they', 'this', 'that', 'these', 'those',
  'the', 'a', 'an', 'and', 'but', 'so', 'if', 'when', 'what', 'why', 'how',
  'my', 'your', 'his', 'her', 'their', 'our', 'its',
  'today', 'now', 'here', 'there', 'okay', 'ok', 'right', 'well', 'yeah', 'yes', 'no',
  'good', 'morning', 'afternoon', 'evening', 'hello', 'hi', 'hey', 'thanks',
  'some', 'every', 'all', 'one', 'two', 'three', 'first', 'last', 'next',
  'let', 'lets', 'just', 'really', 'very', 'also', 'then', 'because',
])

export interface ResolvedMention {
  /** What the transcript said. */
  heard: string
  canonical: string
  score: number
}

export interface UncertainMention {
  heard: string
  suggestions: string[]
}

export interface MentionReport {
  confirmed: ResolvedMention[]
  uncertain: UncertainMention[]
  /** Looked like a product, matched nothing. */
  unknown: string[]
  /** False when the catalogue could not be reached — say so, do not pretend. */
  catalogueChecked: boolean
}

/**
 * Pull the phrases that look like product names out of a transcript.
 *
 * Runs of capitalised words. Deepgram capitalises proper nouns, and a
 * fragrance is almost always said as house-then-name — "Byredo Blanche",
 * "Ormonde Jayne Bijou Zafran" — so a capitalised run is the right shape to
 * look for. A run that merely starts a sentence is dropped, or every "Today"
 * and "This" in the clip would be checked against 75,000 bottles.
 */
export function extractCandidates(transcript: string, limit = 12): string[] {
  const candidates: string[] = []
  const seen = new Set<string>()

  // Split on sentence ends so a full stop cannot glue two names together.
  for (const sentence of transcript.split(/(?<=[.!?])\s+|\n+/)) {
    const words = sentence.trim().split(/\s+/)
    let run: string[] = []

    const flush = (atSentenceStart: boolean) => {
      let parts = run
      // "Today Byredo Blanche is…" — the leading word is the sentence opening,
      // not part of the name.
      if (atSentenceStart && parts.length > 1 && SENTENCE_STARTERS.has(strip(parts[0]).toLowerCase())) {
        parts = parts.slice(1)
      }
      run = []
      if (parts.length < 2 || parts.length > 4) return
      if (parts.every((word) => SENTENCE_STARTERS.has(strip(word).toLowerCase()))) return

      const phrase = parts.map(strip).join(' ').trim()
      const key = phrase.toLowerCase()
      if (!phrase || seen.has(key)) return
      seen.add(key)
      candidates.push(phrase)
    }

    for (const [index, word] of words.entries()) {
      if (/^[A-Z][A-Za-z'’&+-]*[.,;:!?]?$/.test(word)) {
        if (run.length === 0) run = [word]
        else run.push(word)
        continue
      }
      flush(index - run.length === 0)
      run = []
    }
    flush(words.length - run.length === 0)
  }

  return candidates.slice(0, limit)
}

function strip(word: string): string {
  return word.replace(/[.,;:!?]+$/, '')
}

/** One name per bottle, best-scoring spelling first. */
function dedupeBottles(hits: readonly FuzzyHit[]): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const hit of hits) {
    const key = bottleKey(hit)
    if (seen.has(key)) continue
    seen.add(key)
    names.push(canonicalOf(hit))
  }
  return names
}

/** The catalogue's answer for one heard phrase. */
function judge(heard: string, hits: FuzzyHit[]): 'confirmed' | 'uncertain' | 'unknown' {
  if (hits.length === 0) return 'unknown'
  const best = hits[0]
  if (best.score < WORTH_ASKING) return 'unknown'

  // Ignore duplicates of the same bottle when measuring the margin — the RPC
  // returns "Byredo Blanche" and "Byredo Blanche Byredo" as separate rows.
  const rival = hits.find((hit) => bottleKey(hit) !== bottleKey(best))
  const clear = !rival || best.score - rival.score >= REQUIRED_MARGIN

  return best.score >= CORRECT_SILENTLY && clear ? 'confirmed' : 'uncertain'
}

function canonicalOf(hit: FuzzyHit): string {
  const hasBrand = hit.name.toLowerCase().includes(hit.brand.toLowerCase())
  return (hasBrand ? hit.name : `${hit.brand} ${hit.name}`).trim()
}

/**
 * Two rows are the same bottle if they are the same words in any order.
 *
 * The catalogue holds "Byredo Blanche", "Blanche Byredo" and "Byredo Blanche
 * By" as separate rows. Treating those as three rival products made a certain
 * answer look like a three-way tie, so the one name we could definitely have
 * corrected was the one we refused to.
 */
function bottleKey(hit: FuzzyHit): string {
  return [...new Set(canonicalOf(hit).toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/))]
    .filter((word) => word && word !== 'by')
    .sort()
    .join(' ')
}

/**
 * Check every candidate against the catalogue.
 *
 * Queries run together rather than in sequence: a dozen round trips one after
 * another would add seconds to every upload, and the owner is watching a
 * progress bar while they happen.
 */
export async function resolveMentions(
  transcript: string | null,
  /**
   * The brand's own name and its known mis-hearings.
   *
   * "Scent Sell" is not a fragrance, but the catalogue will happily offer
   * Hugo Boss Scent for it — and being told its own name is an unverifiable
   * product is worse than useless.
   */
  ownNames: readonly string[] = [],
  env: Record<string, string | undefined> = process.env,
): Promise<MentionReport> {
  const empty: MentionReport = { confirmed: [], uncertain: [], unknown: [], catalogueChecked: false }
  if (!transcript?.trim()) return empty
  if (!catalogueAvailable(env)) return empty

  const ours = new Set(ownNames.map((name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')))
  const candidates = extractCandidates(transcript)
    .filter((phrase) => !ours.has(phrase.toLowerCase().replace(/[^a-z0-9]/g, '')))
  if (candidates.length === 0) return { ...empty, catalogueChecked: true }

  const results = await Promise.all(candidates.map(async (heard) => ({
    heard,
    hits: await bestHits(heard, env),
  })))

  const report: MentionReport = { confirmed: [], uncertain: [], unknown: [], catalogueChecked: true }
  for (const { heard, hits } of results) {
    switch (judge(heard, hits)) {
      case 'confirmed':
        report.confirmed.push({ heard, canonical: canonicalOf(hits[0]), score: hits[0].score })
        break
      case 'uncertain':
        report.uncertain.push({
          heard,
          suggestions: dedupeBottles(hits.filter((h) => h.score >= WORTH_ASKING)).slice(0, 3),
        })
        break
      default:
        report.unknown.push(heard)
    }
  }
  return report
}

/**
 * Drop candidates that merely sound vaguely similar overall.
 *
 * Sound-folding is generous by design, so "Mulan Cha" scores 0.71 against Puma
 * Challenge — no shared word, just a similar shape. Requiring one whole word
 * to survive intact removes that entirely, and costs nothing real: in a
 * garbled name at least one word almost always does survive, which is what
 * made it findable in the first place.
 */
function shareAWord(heard: string, hits: readonly FuzzyHit[]): FuzzyHit[] {
  const heardWords = new Set(heard.split(/\s+/).map(fold).filter((word) => word.length >= 2))
  if (heardWords.size === 0) return [...hits]

  return hits.filter((hit) =>
    `${hit.brand} ${hit.name}`.split(/\s+/).map(fold).some((word) => heardWords.has(word)))
}

/**
 * Query the catalogue, falling back to the house on its own.
 *
 * "Ormond Janes Bijous Saffron" is four garbled words and scores near zero as
 * a whole phrase — trigram similarity drops fast as the wrong letters pile up.
 * The first two words are the house, and asking for those alone finds Ormonde
 * Jayne. Without this the longest, most garbled names — the ones most in need
 * of correcting — were the ones that came back as nothing at all.
 */
async function bestHits(
  heard: string,
  env: Record<string, string | undefined>,
): Promise<FuzzyHit[]> {
  const full = shareAWord(heard, await bestMatch(heard, env).catch(() => []))
  if (full.length > 0 && full[0].score >= WORTH_ASKING) return full

  const words = heard.split(/\s+/)
  if (words.length < 3) return full

  const windows = [words.slice(0, 2).join(' '), words.slice(-2).join(' ')]
  const partial = (await Promise.all(windows.map((w) => bestMatch(w, env).catch(() => []))))
    .flat()
    .sort((a, b) => b.score - a.score)

  // A house matched from part of the phrase is a lead, never a confirmation:
  // knowing it is Ormonde Jayne does not tell us WHICH Ormonde Jayne.
  return partial.map((hit) => ({ ...hit, score: Math.min(hit.score, CORRECT_SILENTLY - 0.01) }))
}

/**
 * The report as instructions for whoever is about to write the copy.
 *
 * Written as hard rules rather than advice. "Prefer the verified spelling" is
 * the kind of instruction a model weighs against fluency and loses.
 */
export function mentionsPrompt(report: MentionReport): string | null {
  if (!report.catalogueChecked) return null
  const lines: string[] = []

  if (report.confirmed.length > 0) {
    lines.push(
      'PRODUCT NAMES — the transcript is speech-to-text and misspells them. These have been',
      'checked against the fragrance catalogue. Use the spelling on the right, exactly, every time:',
      ...report.confirmed.map((m) => `- heard "${m.heard}" → write "${m.canonical}"`),
    )
  }

  if (report.uncertain.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(
      'These could not be pinned down. Do NOT write any of them, and do not write your best guess',
      'either — ask which was meant, naming the closest options, and write around it meanwhile:',
      ...report.uncertain.map((m) => `- heard "${m.heard}" — closest: ${m.suggestions.join(', ') || 'nothing close'}`),
    )
  }

  if (report.unknown.length > 0) {
    if (lines.length > 0) lines.push('')
    lines.push(
      'Not in the catalogue at all, so treat them as mis-heard rather than real:',
      ...report.unknown.map((m) => `- "${m}"`),
    )
  }

  if (lines.length === 0) return null

  lines.push(
    '',
    'Never write the name of a fragrance, house or perfumer that is not confirmed above. A caption',
    'with one fewer product name can be fixed. A caption that misspells a real house is what the',
    "owner's customers see.",
  )
  return lines.join('\n')
}
