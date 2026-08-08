/**
 * Spell the brand correctly, by correcting it rather than asking.
 *
 * "ScentSell" was written into copy shown to the owner after a full day of
 * work on exactly this — and the spelling was ALREADY listed as forbidden in
 * the brand record. The list was reaching the model as an instruction, and an
 * instruction competes with fluency: a model that has just written a fluent
 * sentence containing "ScentSell" has no signal telling it that word is wrong.
 *
 * The same lesson as the draft-claim check. A rule that must hold every time
 * is checked, not requested. This runs over the finished text and replaces
 * every known-wrong spelling with the real one.
 *
 * WHAT IT MUST NOT TOUCH. The website is scentsell.com.au and the Instagram
 * handle is @scentsellsocials — both correct, both containing a "forbidden"
 * spelling. Rewriting them would break a link and tag a stranger, which is
 * worse than the problem being fixed. So URLs, handles, hashtags and email
 * addresses are left exactly as they are.
 */

export interface BrandNaming {
  /** The one correct spelling. */
  name: string
  /** Spellings that are always wrong in prose. */
  nameNever: readonly string[]
}

export interface NameFix {
  text: string
  /** What was replaced, for the log. Empty when nothing was wrong. */
  corrected: string[]
}

/**
 * Spans that are addresses rather than prose.
 *
 * Matched first and skipped whole: a URL, an @handle, a #hashtag, or an email.
 * Inside any of them the "wrong" spelling is the right one.
 */
const ADDRESS = /(https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+|[@#][A-Za-z0-9_.]+|\b[a-z0-9-]+\.(?:com|com\.au|net|org|io|co)(?:\.[a-z]{2})?\b)/gi

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replace every wrong spelling in the prose parts of the text.
 *
 * Longest variants first, so "Scent Sail Fragrance" cannot be half-matched by
 * a shorter entry and left in a worse state than it started.
 */
export function enforceBrandName(text: string, brand: BrandNaming): NameFix {
  if (!text || !brand.name || brand.nameNever.length === 0) return { text, corrected: [] }

  const variants = [...brand.nameNever]
    .filter((variant) => variant && variant.toLowerCase() !== brand.name.toLowerCase())
    .sort((a, b) => b.length - a.length)
  if (variants.length === 0) return { text, corrected: [] }

  const pattern = new RegExp(`\\b(${variants.map(escapeForRegex).join('|')})\\b`, 'gi')
  const corrected: string[] = []

  // Split on addresses so the replace only ever sees prose. The capture group
  // in ADDRESS means the separators come back in the array and are re-joined
  // untouched.
  const fixed = text
    .split(ADDRESS)
    .map((chunk, index) => {
      // Odd indices are the captured addresses themselves.
      if (index % 2 === 1) return chunk
      return chunk.replace(pattern, (match) => {
        corrected.push(match)
        return brand.name
      })
    })
    .join('')

  return { text: fixed, corrected }
}

/**
 * Wrong spellings still present after correction.
 *
 * Only ever non-empty if something slipped through — a variant inside a word,
 * say. Reported rather than silently accepted, because the whole point is that
 * this cannot fail quietly.
 */
export function remainingMistakes(text: string, brand: BrandNaming): string[] {
  const variants = brand.nameNever
    .filter((variant) => variant && variant.toLowerCase() !== brand.name.toLowerCase())
    .sort((a, b) => b.length - a.length)
  if (variants.length === 0) return []

  const prose = text.split(ADDRESS).filter((_, index) => index % 2 === 0).join(' ')
  const pattern = new RegExp(`\\b(${variants.map(escapeForRegex).join('|')})\\b`, 'gi')

  // The substrings actually present, not the variants that would match them.
  // Several listed spellings differ only by case, so reporting variants gives
  // two entries for one mistake and reads like twice the problem.
  return [...new Set(prose.match(pattern) ?? [])]
}
