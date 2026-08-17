import { useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import type { Brand } from '@/types/database'

/**
 * Turns the business's own stored colour into the three interface accents
 * (`--brand`, `--brand-deep`, `--brand-wash`) that retint the shell when the
 * owner switches business.
 *
 * Three things here are deliberate and each one is a bug that has already been
 * paid for somewhere in this codebase:
 *
 * 1. THE BUSINESS SUPPLIES THE HUE. THE SYSTEM SUPPLIES THE LIGHTNESS.
 *    Every step below pins its own L and derives only C and H from the stored
 *    colour. That is what makes the contrast predictable: white on
 *    `--brand-deep` and dark ink on `--brand-wash` read the same whether the
 *    business chose clinical teal or fluoro orange. Passing the brand's own
 *    lightness through would make a pale brand's buttons unreadable and nobody
 *    would find out until it was live.
 *
 * 2. NO COLOUR SET MEANS NO COLOUR INVENTED.
 *    An unset slot falls back to the house silver/chrome at hue 240 and is
 *    flagged `isFallback`. Nothing here writes back to the database.
 *    BrandColoursEditor had exactly that bug — a default seeded into the picker
 *    meant the first Save wrote Facebook blue into brands that had chosen
 *    nothing. Display-only fallbacks never leave this module.
 *
 * 3. NEVER `color-mix` IN OKLCH.
 *    It interpolates through pink and has been rejected twice. The darker and
 *    paler steps are derived numerically — a fixed L, and a C scaled by the
 *    same ratios the approved mockup hard-codes — never by mixing.
 */

// ─── The ramp ────────────────────────────────────────────────────────────────

/**
 * The chroma the approved mockup uses for `--brand` in light mode
 * (`oklch(0.545 0.115 205)`). Every other step is expressed as a fraction of
 * it, so the whole ramp scales together with whatever chroma the business's
 * colour actually carries.
 */
const REFERENCE_CHROMA = 0.115

/**
 * Chroma is capped, not passed through. A business that stores a fully
 * saturated colour would otherwise push `--brand-wash` — a background that
 * carries body text — well past the point where it stops being a wash.
 */
const CHROMA_CEILING = REFERENCE_CHROMA

/**
 * Below this, a colour has no usable hue: black, white, and every grey land
 * here, and `atan2` on their near-zero a/b returns noise. Treated as "no
 * colour chosen" rather than tinting the entire product off a rounding error.
 */
const ACHROMATIC_THRESHOLD = 0.01

/** The house silver/chrome hue. Used when the business has set nothing. */
const FALLBACK_HUE = 240

/**
 * Quiet on purpose. The fallback has to read as chrome — the absence of a
 * choice — not as a colour someone picked. It sits just above the 0.012 the
 * house palette already carries on `--muted-foreground`.
 */
const FALLBACK_CHROMA = 0.03

interface Step {
  /** Fixed lightness. Never taken from the business's colour. */
  l: number
  /** Chroma as a fraction of the resolved chroma. */
  f: number
}

/**
 * Light and dark are separate ramps rather than one ramp inverted, because in
 * dark mode the accent gets LIGHTER as it gets "deeper" — `--brand-deep` is
 * the high-contrast fill in both themes, which means L 0.33 in light and L 0.87
 * in dark. Carried straight from the approved mockup so every screen is
 * visibly the same product.
 */
const RAMPS = {
  light: {
    brand: { l: 0.545, f: 1 },
    deep: { l: 0.33, f: 0.08 / REFERENCE_CHROMA },
    wash: { l: 0.966, f: 0.026 / REFERENCE_CHROMA },
    /**
     * Text and icons sitting ON a `--brand` / `--brand-deep` fill. White in
     * light mode; in dark mode those fills are light, so white on them is very
     * nearly invisible. The mockup patches that per-button
     * (`.side .cta{color:oklch(0.17 0.020 205)}` inside its dark block); a
     * variable means no future button has to remember.
     */
    ink: { l: 1, f: 0 },
  },
  dark: {
    brand: { l: 0.74, f: 0.11 / REFERENCE_CHROMA },
    deep: { l: 0.87, f: 0.08 / REFERENCE_CHROMA },
    wash: { l: 0.272, f: 0.038 / REFERENCE_CHROMA },
    ink: { l: 0.17, f: 0.02 / REFERENCE_CHROMA },
  },
} as const

// ─── Reading whatever the business actually stored ───────────────────────────

interface Rgb {
  r: number
  g: number
  b: number
}

export interface Oklch {
  l: number
  c: number
  h: number
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

/** One rgb() channel — accepts `128` or `50%`. */
function parseChannel(raw: string | undefined): number | null {
  const token = (raw ?? '').trim()
  if (!token) return null
  if (token.endsWith('%')) {
    const pct = Number(token.slice(0, -1))
    return Number.isFinite(pct) ? clampByte((pct / 100) * 255) : null
  }
  const n = Number(token)
  return Number.isFinite(n) ? clampByte(n) : null
}

/**
 * `brand_colours` is not all hex. Downscale stores `rgba(30,41,59,.9)` and
 * TeleCheck Clinic stores `rgb(15 23 42/.95)`, and an agent that has read the
 * house rules may well have written `oklch(...)` straight in. All three are the
 * owner's colour and all three must retint. Anything else returns null and the
 * caller falls back to silver rather than guessing.
 *
 * Alpha is parsed off and discarded — an accent variable is a solid colour, and
 * a half-transparent `--brand` would let the page behind it change the tint.
 */
function parseToRgb(raw: string): Rgb | null {
  const value = raw.trim()
  if (!value) return null

  const hexMatch = /^#([0-9a-f]+)$/i.exec(value)
  if (hexMatch) {
    const digits = hexMatch[1].toLowerCase()
    if (digits.length === 3 || digits.length === 4) {
      const [r, g, b] = digits.split('')
      return {
        r: parseInt(`${r}${r}`, 16),
        g: parseInt(`${g}${g}`, 16),
        b: parseInt(`${b}${b}`, 16),
      }
    }
    if (digits.length === 6 || digits.length === 8) {
      return {
        r: parseInt(digits.slice(0, 2), 16),
        g: parseInt(digits.slice(2, 4), 16),
        b: parseInt(digits.slice(4, 6), 16),
      }
    }
    return null
  }

  const fnMatch = /^rgba?\(([^)]*)\)$/i.exec(value)
  if (fnMatch) {
    const [channelPart] = fnMatch[1].split('/')
    const parts = channelPart.trim().split(/[\s,]+/).filter(Boolean)
    const r = parseChannel(parts[0])
    const g = parseChannel(parts[1])
    const b = parseChannel(parts[2])
    if (r === null || g === null || b === null) return null
    return { r, g, b }
  }

  return null
}

/** `oklch(0.545 0.115 205)` / `oklch(54.5% 0.115 205deg / 0.9)`. */
function parseOklchString(raw: string): Oklch | null {
  const match = /^oklch\(([^)]*)\)$/i.exec(raw.trim())
  if (!match) return null

  const [channelPart] = match[1].split('/')
  const parts = channelPart.trim().split(/[\s,]+/).filter(Boolean)
  if (parts.length < 3) return null

  const lRaw = parts[0]
  const cRaw = parts[1]
  const l = lRaw.endsWith('%') ? Number(lRaw.slice(0, -1)) / 100 : Number(lRaw)
  // A percentage chroma is a percentage of 0.4, per the CSS Color 4 definition.
  const c = cRaw.endsWith('%')
    ? (Number(cRaw.slice(0, -1)) / 100) * 0.4
    : Number(cRaw)
  const h = Number(parts[2].replace(/deg$/i, ''))

  if (!Number.isFinite(l) || !Number.isFinite(c) || !Number.isFinite(h)) return null
  return { l, c, h }
}

function srgbToLinear(channel: number): number {
  const v = channel / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

/**
 * sRGB → OKLCH, via Björn Ottosson's OKLab matrices. Written out rather than
 * pulled from a colour library: this is the only conversion the interface
 * needs, and the alternative is a dependency on the render path of every
 * screen.
 */
function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = srgbToLinear(r)
  const lg = srgbToLinear(g)
  const lb = srgbToLinear(b)

  const long = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb
  const medium = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb
  const short = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb

  const l_ = Math.cbrt(long)
  const m_ = Math.cbrt(medium)
  const s_ = Math.cbrt(short)

  const lightness = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const chroma = Math.sqrt(a * a + bb * bb)
  const hue = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360

  return { l: lightness, c: chroma, h: hue }
}

/** Any colour string the database might hold → OKLCH, or null if unreadable. */
export function readColour(raw: string | null | undefined): Oklch | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  const direct = parseOklchString(value)
  if (direct) return direct
  const rgb = parseToRgb(value)
  return rgb ? rgbToOklch(rgb) : null
}

// ─── Which slot the accent comes from ────────────────────────────────────────

/**
 * Slots are independently optional — BrandColoursEditor never saves one the
 * owner left alone — so a business may well have set `accent` and nothing else.
 * Reading only `primary` would leave that business grey while its settings page
 * showed a colour, which reads as broken rather than as honest.
 */
const ACCENT_SLOTS = ['primary', 'accent', 'secondary'] as const

export type BrandColourSource = Pick<Brand, 'brand_colours'> | null | undefined

/** The raw stored string this business should be tinted from, if any. */
export function brandAccentColour(brand: BrandColourSource): string | null {
  const colours = brand?.brand_colours
  if (!colours) return null
  for (const slot of ACCENT_SLOTS) {
    const value = (colours[slot] ?? '').trim()
    if (value) return value
  }
  return null
}

// ─── Deriving the variables ──────────────────────────────────────────────────

export interface ResolvedAccent {
  hue: number
  chroma: number
  /** True when nothing usable was stored and this is house silver/chrome. */
  isFallback: boolean
}

/**
 * Hue and chroma only. The lightness of the stored colour is thrown away on
 * purpose — see the note at the top of the file.
 */
export function resolveAccent(colour: string | null | undefined): ResolvedAccent {
  const read = readColour(colour)
  if (!read || read.c < ACHROMATIC_THRESHOLD) {
    return { hue: FALLBACK_HUE, chroma: FALLBACK_CHROMA, isFallback: true }
  }
  return {
    hue: read.h,
    chroma: Math.min(read.c, CHROMA_CEILING),
    isFallback: false,
  }
}

function step({ l, f }: Step, accent: ResolvedAccent): string {
  const c = Math.round(accent.chroma * f * 10000) / 10000
  // A hue on a zero-chroma colour is noise in devtools and means nothing to the
  // renderer — white is white.
  if (c === 0) return `oklch(${l} 0 0)`
  const h = Math.round(accent.hue * 10) / 10
  return `oklch(${l} ${c} ${h})`
}

export interface BrandThemeOptions {
  /** Which side of the theme to build for. */
  dark?: boolean
}

/**
 * The style object the shell spreads onto its root element. Everything below
 * it — sidebar, department header, Director rail — reads `var(--brand)` and
 * retints for free.
 */
export function brandThemeVars(
  colour: string | null | undefined,
  { dark = false }: BrandThemeOptions = {},
): CSSProperties {
  const accent = resolveAccent(colour)
  const ramp = dark ? RAMPS.dark : RAMPS.light

  return {
    '--brand': step(ramp.brand, accent),
    '--brand-deep': step(ramp.deep, accent),
    '--brand-wash': step(ramp.wash, accent),
    '--brand-ink': step(ramp.ink, accent),
  } as unknown as CSSProperties
}

// ─── Which theme is on ───────────────────────────────────────────────────────

/**
 * Read from the `dark` class on <html> rather than from `useTheme()`.
 *
 * next-themes writes that class in a script that runs before paint, but its
 * hook reports `undefined` until after mount — so a style object computed from
 * it renders one frame of the wrong theme's accents on every load. Reading the
 * class through `useSyncExternalStore` gets the right answer on the very first
 * client render, and React treats a server/client snapshot difference here as
 * expected rather than as a hydration error.
 *
 * The server snapshot is `true` because the app's ThemeProvider is
 * `defaultTheme="dark"` with `enableSystem={false}`.
 */
function subscribeToTheme(onChange: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => observer.disconnect()
}

function readDarkFromDom(): boolean {
  return document.documentElement.classList.contains('dark')
}

function darkOnServer(): boolean {
  return true
}

export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribeToTheme, readDarkFromDom, darkOnServer)
}

/**
 * The one call the shell needs: give it the active business, spread the result
 * onto the root element.
 */
export function useBrandTheme(brand: BrandColourSource): CSSProperties {
  const dark = useIsDarkTheme()
  return brandThemeVars(brandAccentColour(brand), { dark })
}
