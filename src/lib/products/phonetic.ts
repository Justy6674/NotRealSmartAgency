/**
 * Compare names by SOUND, because that is how they were got wrong.
 *
 * The catalogue's trigram matcher compares letters. Speech-to-text does not
 * make letter mistakes, it makes sound mistakes, and the two barely overlap:
 *
 *   heard "Mulan Cha"  →  actually Nishane WULONG CHA
 *
 * To a person those are obviously the same words. To a trigram index they
 * share almost nothing — "mul"/"wul", "ulа"/"ulo" — so the real answer scored
 * 0.00 and the top hit was "Western Valley Mulan Rouge", a different house,
 * a different bottle, and the thing the owner's own marketing app told him he
 * was wearing.
 *
 * So names get folded to a rough sound before they are compared. The folding
 * is deliberately aggressive about the distinctions a recogniser loses — every
 * vowel becomes the same vowel, letters that sound alike collapse together —
 * and deliberately keeps the ones it does not, chiefly the number and order of
 * consonants. Being too clever here is how you confidently match the wrong
 * bottle, so the folding only ever produces a SCORE. Nothing here decides on
 * its own that a name is right.
 *
 * Soundex and Metaphone were both considered and both rejected: they key on
 * the first letter, and the first letter is exactly what gets lost — Wulong
 * became Mulan, ScentSell became Sentel.
 */

/**
 * Reduce a name to the sounds a recogniser would have had to get right.
 *
 * Order matters: digraphs are handled before single letters, or "ph" is two
 * sounds by the time the rule for "h" sees it.
 */
export function fold(value: string): string {
  // Word by word. Folding the whole phrase at once let the trailing-vowel rule
  // eat the "a" off the END of the phrase rather than off each word — so
  // "Mulan Cha" folded to something one edit from "Milan", and a random
  // designer bottle outranked the Nishane the owner was actually wearing.
  return value.trim().split(/\s+/).map(foldWord).join('')
}

function foldWord(value: string): string {
  let text = value.toLowerCase().replace(/[^a-z]/g, '')
  if (!text) return ''

  text = text
    // Digraphs first.
    .replace(/ph/g, 'f')
    .replace(/gh/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/ch/g, 'X')   // held apart from plain k: "Cha" is not "Ka"
    .replace(/sh/g, 'X')   // and a recogniser routinely swaps the two
    .replace(/th/g, 't')
    // A silent or near-silent letter the recogniser had no chance with.
    .replace(/h/g, '')
    // Letters that carry the same sound.
    .replace(/[cqk]/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/[zs]/g, 's')
    .replace(/[jg]/g, 'j')
    .replace(/y/g, 'i')
    .replace(/[vw]/g, 'v')
    // Every vowel is the same vowel. This is the single biggest win: vowels
    // are what speech-to-text hears worst and what varies most between an
    // Australian saying a French name and a model trained on American English.
    .replace(/[aeiou]/g, 'a')

  // A doubled sound is one sound.
  //
  // Trailing vowels are deliberately KEPT. Dropping them looks right —
  // "Ormonde" and "Ormond" are the same word — but it costs more than it
  // gains: it also turns "Rouge" into "raj", which pulled Mulan Rouge level
  // with Wulong Cha and put a tie where there had been a clear winner. A
  // silent "e" is one edit in a long word and the distance already forgives
  // it; a lost vowel in a three-letter word is half the word.
  return text.replace(/(.)\1+/g, '$1')
}

/** Levenshtein, bounded so a hopeless pair costs nothing to reject. */
export function editDistance(a: string, b: string, limit = 24): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > limit) return limit + 1

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const value = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost)
      row.push(value)
      if (value < best) best = value
    }
    if (best > limit) return limit + 1
    previous = row
  }
  return previous[b.length]
}

/** 0 to 1. How close two names are once reduced to sound. */
export function phoneticSimilarity(heard: string, candidate: string): number {
  const a = fold(heard)
  const b = fold(candidate)
  if (!a || !b) return 0
  if (a === b) return 1

  const distance = editDistance(a, b, Math.max(a.length, b.length))
  return Math.max(0, 1 - distance / Math.max(a.length, b.length))
}

/**
 * Score a heard phrase against a catalogue entry.
 *
 * Tried three ways, because what the owner said is not a database row. He says
 * "Wulong Cha" without the house, "Byredo Blanche" with it, and sometimes the
 * house alone. Scoring only against "brand + name" would penalise the most
 * natural way to say it.
 */
export function scoreAgainstEntry(heard: string, brand: string, name: string): number {
  const combined = name.toLowerCase().includes(brand.toLowerCase()) ? name : `${brand} ${name}`
  return Math.max(
    phoneticSimilarity(heard, combined),
    phoneticSimilarity(heard, name),
    // Only worth considering when the heard phrase is short enough to BE a
    // house name; otherwise "Ormond Janes Bijous Saffron" scores well against
    // the house alone and we lose which bottle was meant.
    heard.trim().split(/\s+/).length <= 2 ? phoneticSimilarity(heard, brand) : 0,
  )
}

/**
 * The words worth searching the catalogue for.
 *
 * In a garbled name at least one word is usually intact — "Mulan CHA",
 * "Birredo BLANCHE" — and that intact word is the cheapest way to pull the
 * right row out of 114,000 without scanning them all.
 */
export function searchTokens(heard: string): string[] {
  return [...new Set(
    heard
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  )]
}
