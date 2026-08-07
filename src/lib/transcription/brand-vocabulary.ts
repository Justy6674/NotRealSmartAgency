/**
 * Teach speech-to-text the brand's own words, and repair what it still gets wrong.
 *
 * Why this exists: the owner filmed himself saying "ScentSell" and the transcript
 * came back "Hey. It's Justin from Sentel… sellers can put their own fragrances
 * on Scentel". Every consumer downstream — the opener, the caption, the proposal —
 * faithfully repeated the misspelling, and the owner watched his own marketing
 * platform get his company's name wrong in public-facing copy.
 *
 * That is not a prompting problem and it is not fixable by telling a model to
 * spell better. A brand name is a proper noun the recogniser has never heard, so
 * it substitutes the nearest English-sounding thing. It is fixed in two places:
 *
 *   1. AT SOURCE — the name is handed to the recogniser as a boosted keyword, so
 *      it is a candidate before it ever guesses.
 *   2. AFTER — whatever still slips through is corrected once, in the stored
 *      transcript, so no consumer ever sees the wrong spelling. Repairing it in
 *      one place is the point: correcting it in the caption writer alone would
 *      leave the opener, the tags and the search index all still wrong.
 */

/** Strip everything that is not a letter or a digit, and lower-case it. */
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Sounds-alike key for one word.
 *
 * Deliberately blunt rather than a full phonetic algorithm: it collapses the
 * distinctions speech-to-text actually confuses in a brand name — the letters it
 * cannot hear apart, doubled letters, and the trailing vowels it drops. Soundex
 * and Metaphone both key on the FIRST letter, which is exactly the letter that
 * gets lost ("ScentSell" → "Sentel" loses the c), so neither would catch this.
 */
export function soundKey(word: string): string {
  let key = squash(word)
  if (!key) return ''

  key = key
    .replace(/ph/g, 'f')
    .replace(/ck|kh|q/g, 'k')
    .replace(/sc(?=[eiy])/g, 's')   // ScentSell → Sentsell: the exact loss seen
    .replace(/c(?=[eiy])/g, 's')     // celeb → seleb
    .replace(/c/g, 'k')
    .replace(/z/g, 's')
    .replace(/x/g, 'ks')
    .replace(/[wh]/g, '')
    .replace(/[aeiou]+/g, 'a')       // vowels are the least reliable part
    .replace(/(.)\1+/g, '$1')        // sell → sel, tt → t

  return key
}

/** Levenshtein distance, abandoned early once it exceeds `limit`. */
export function editDistance(a: string, b: string, limit: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > limit) return limit + 1

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    let best = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
      if (current[j] < best) best = current[j]
    }
    if (best > limit) return limit + 1
    previous = current
  }
  return previous[b.length]
}

/** The consonants of a sound key, in order. Vowels carry almost no signal here. */
export function consonantSkeleton(key: string): string {
  return key.replace(/a/g, '')
}

/**
 * Do these two sound close enough to be the same brand name?
 *
 * Not edit distance. Edit distance treats every difference alike, and at the
 * tolerance needed to catch "Sentel" it also catches "central" — which would
 * rewrite "central Sydney" into the brand name, a worse fault than the one
 * being fixed.
 *
 * The rule instead mirrors how the mistake is actually made. A recogniser
 * meeting an unfamiliar proper noun DROPS or MERGES sounds it cannot place; it
 * does not invent new consonants. So:
 *
 *   - every consonant in the candidate must appear in the brand, in order
 *     (a foreign consonant means it is a different word — the 'r' in central,
 *     the 'd' in sandal),
 *   - and at most one of the brand's consonants may have gone missing
 *     (which is exactly the dropped 's' in ScentSell → Sentel).
 *
 * Vowels are free to differ, because they are the least reliably heard part.
 */
export function soundsLikeBrand(candidateKey: string, targetKey: string): boolean {
  if (!candidateKey || !targetKey) return false
  if (candidateKey === targetKey) return true
  if (candidateKey[0] !== targetKey[0]) return false

  const candidate = consonantSkeleton(candidateKey)
  const target = consonantSkeleton(targetKey)
  if (candidate.length === 0 || target.length < 3) return false

  // The END of the word must agree.
  //
  // Without this, "scents" (consonants s-n-t-s) passes as ScentSell (s-n-t-s-l)
  // with one sound missing — and "scents" is a word a fragrance business uses
  // in every second sentence. Rewriting it to the brand name would wreck the
  // transcript far more thoroughly than the mis-hearing did. The tail is what
  // separates a real word from a mangled proper noun.
  if (candidate[candidate.length - 1] !== target[target.length - 1]) return false

  // Walk the brand's consonants, consuming the candidate's in order.
  let t = 0
  for (const sound of candidate) {
    let found = false
    while (t < target.length) {
      if (target[t] === sound) {
        t += 1
        found = true
        break
      }
      t += 1
    }
    if (!found) return false // a consonant the brand does not have
  }

  return target.length - candidate.length <= 1
}

export interface BrandVocabulary {
  /** The wordmark, exactly as it must always appear. */
  canonical: string
  /** Extra proper nouns worth boosting — products, people, sub-brands. */
  terms: string[]
  /**
   * Spellings that mean this brand but must never be printed.
   *
   * The owner's list, not a guess. It covers the run-together form as well as
   * the mishearings, because "ScentSell" and "Scent Sell" sound identical and
   * no amount of phonetics will separate them — only the owner can say which
   * one is his. Matched case-insensitively and rewritten to `canonical`.
   */
  never?: string[]
}

/**
 * Keywords for Deepgram's `keywords` parameter, with a boost weight.
 *
 * Sent one per term. The weight raises the odds the recogniser will choose the
 * brand name over the common English word it sounds like, without making it so
 * eager that it hears the brand everywhere.
 */
export function deepgramKeywordParams(vocabulary: BrandVocabulary, boost = 3): string {
  const terms = [vocabulary.canonical, ...vocabulary.terms]
    .map((term) => term.trim())
    .filter((term) => term.length > 2)

  return [...new Set(terms)]
    .map((term) => `keywords=${encodeURIComponent(`${term}:${boost}`)}`)
    .join('&')
}

/**
 * Correct mis-heard forms of the brand name in a transcript.
 *
 * Matches on how a word SOUNDS, not on a fixed list of misspellings, so a new
 * mangling ("Scentel", "Sentell", "Scent Cell") is caught without anyone having
 * to add it. Two-word runs are checked as well, because a compound name is
 * routinely split in half ("Scent Sell" → "Sent el").
 *
 * Casing of the replacement is always the canonical one: the brand decides how
 * its own name is written, not the sentence position it happened to land in.
 */
export function correctBrandName(text: string, vocabulary: BrandVocabulary): string {
  return correctBrandNameWithCount(text, vocabulary).text
}

/** Same correction, reporting how many it made so the pipeline can log it. */
export function correctBrandNameWithCount(
  text: string,
  vocabulary: BrandVocabulary,
): { text: string; corrections: number } {
  const canonical = vocabulary.canonical.trim()
  if (!text || !canonical) return { text, corrections: 0 }

  const target = soundKey(canonical)
  if (!target) return { text, corrections: 0 }

  // Only worth attempting on a distinctive name. A two-letter key would match
  // half the dictionary and rewrite the transcript into nonsense.
  if (target.length < 4) return { text, corrections: 0 }

  const tokens = [...text.matchAll(/[A-Za-z][A-Za-z'’]*/g)]
  if (tokens.length === 0) return { text, corrections: 0 }

  // The owner's own never-print list wins outright — it is a statement about
  // his brand, not an inference from sound. Longest first, so "Scent Sail"
  // is matched before a shorter entry could take half of it.
  const never = [...(vocabulary.never ?? [])]
    .filter((entry) => entry.trim() && entry.trim() !== canonical)
    .sort((a, b) => b.length - a.length)

  const replacements: Array<{ start: number; end: number }> = []
  let index = 0

  while (index < tokens.length) {
    const single = tokens[index]
    const pair = tokens[index + 1]
    const between = pair ? text.slice(single.index! + single[0].length, pair.index!) : ''

    // 1. A spelling the owner has forbidden. Checked first and checked on the
    //    literal text, because "ScentSell" and "Scent Sell" sound identical —
    //    no phonetic rule can tell them apart, and only the owner can say
    //    which one is his brand.
    const oneWord = single[0]
    const twoWords = pair && /^ ?$/.test(between) ? `${single[0]} ${pair[0]}` : null
    const bannedPair = twoWords && never.some((entry) => entry.toLowerCase() === twoWords.toLowerCase())
    const bannedOne = never.some((entry) => entry.toLowerCase() === oneWord.toLowerCase())

    if (bannedPair) {
      replacements.push({ start: single.index!, end: pair!.index! + pair![0].length })
      index += 2
      continue
    }
    if (bannedOne) {
      replacements.push({ start: single.index!, end: single.index! + single[0].length })
      index += 1
      continue
    }

    // 2. Two words joined ONLY across a plain space and ONLY on an exact sound
    //    match. Both conditions were learned from real data: any tolerance on
    //    a pair turned "fun scents. So we've got" into "fun ScentSell we've
    //    got", welding one sentence to the next and deleting words.
    if (pair && /^ ?$/.test(between) && soundKey(single[0] + pair[0]) === target) {
      // Already written the way the owner wants it — leave it alone.
      if (twoWords !== canonical) {
        replacements.push({ start: single.index!, end: pair.index! + pair[0].length })
      }
      index += 2
      continue
    }

    // 3. A single word that sounds like the brand. Skipped only when it is
    //    already EXACTLY the wordmark — comparing squashed forms would treat
    //    "ScentSell" as already correct when the brand is "Scent Sell".
    if (soundsLikeBrand(soundKey(single[0]), target) && single[0] !== canonical) {
      replacements.push({ start: single.index!, end: single.index! + single[0].length })
    }
    index += 1
  }

  if (replacements.length === 0) return { text, corrections: 0 }

  let out = ''
  let cursor = 0
  for (const span of replacements) {
    out += text.slice(cursor, span.start) + canonical
    cursor = span.end
  }
  return { text: out + text.slice(cursor), corrections: replacements.length }
}
