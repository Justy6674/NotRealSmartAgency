/**
 * Whether the GIF and stock photo tabs can actually do anything.
 *
 * THE FAULT THIS CLOSES: the two tabs were on the glass and sat behind a
 * correctly authenticated proxy that then had no credential to spend. The
 * owner clicked, waited through a skeleton grid, and got a sentence. Both tabs
 * had been an authenticated door to nothing since the day they were built —
 * the suppliers were never signed up for, so nothing was ever going to load.
 * A control that cannot work must not be offered as though it can.
 *
 * The check is server-side on purpose. The credentials are server-only, so a
 * client-side `process.env` read would inline `undefined` into the browser
 * bundle at build time and be permanently wrong the moment a key was added —
 * which is the opposite of what this is for. The desk asks the server what is
 * switched on; the server reads the live environment on every call and caches
 * nothing. Add the keys and redeploy and the tabs light up with no code change
 * and no edit here.
 *
 * Read the names explicitly rather than indexing `process.env` by a variable:
 * the bundler rewrites the literal form and leaves the dynamic one alone, and
 * on a route that later moves to the edge the dynamic form returns nothing.
 */

export type PhotoSource = 'pexels' | 'unsplash'

export interface StockCapability {
  /** The GIF tab can search. */
  gifs: boolean
  /** The stock photo tab can search at least one supplier. */
  photos: boolean
  /**
   * Which photo suppliers are live. The picker offers a toggle between them;
   * with one configured and one not, offering both is offering a dead button,
   * so the toggle follows this list rather than a hard-coded pair.
   */
  photoSources: PhotoSource[]
}

export interface StockCredentials {
  GIPHY_API_KEY?: string
  UNSPLASH_ACCESS_KEY?: string
  PEXELS_API_KEY?: string
}

/** A key set to an empty string, or to whitespace, is not a key. */
function isSet(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function readStockCapability(credentials?: StockCredentials): StockCapability {
  const env: StockCredentials = credentials ?? {
    GIPHY_API_KEY: process.env.GIPHY_API_KEY,
    UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY,
    PEXELS_API_KEY: process.env.PEXELS_API_KEY,
  }

  const photoSources: PhotoSource[] = []
  // Pexels first: it is the picker's default, so it should be the default here
  // too when both are live.
  if (isSet(env.PEXELS_API_KEY)) photoSources.push('pexels')
  if (isSet(env.UNSPLASH_ACCESS_KEY)) photoSources.push('unsplash')

  return {
    gifs: isSet(env.GIPHY_API_KEY),
    photos: photoSources.length > 0,
    photoSources,
  }
}
