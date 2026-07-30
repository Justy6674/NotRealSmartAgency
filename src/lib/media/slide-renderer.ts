import { readFile } from 'node:fs/promises'
import path from 'node:path'
import satori from 'satori'
import sharp from 'sharp'

/**
 * Render a carousel slide from the brand's own assets.
 *
 * Generated slides were made by describing a design to an image model. That
 * cannot hold a brand: it chose its own typeface every time, so two slides in
 * one carousel came back in different fonts, and every project looked the
 * same because only the two hex codes in the prompt ever changed. A patient
 * app read exactly like a fragrance marketplace.
 *
 * This composes the slide instead of asking for one. The brand's real
 * typefaces, its exact palette, a fixed layout, its actual logo — the same
 * inputs produce the same slide every time, which is the whole point of a
 * template and the one thing a generative model cannot offer.
 */

export interface SlideBrand {
  name: string
  /** Display face for the headline, e.g. Fraunces. */
  displayFont: string
  /** Body face for the supporting line, e.g. Manrope. */
  bodyFont: string
  colours: {
    background: string
    text: string
    accent: string
  }
  /** PNG buffer of the real logo, already fetched. */
  logo?: Buffer | null
}

export interface SlideContent {
  /** The line that carries the slide. Kept short by the writer. */
  headline: string
  /** Optional supporting line beneath it. */
  body?: string | null
  /** Shown small in a corner, e.g. "3/7". */
  step?: string | null
}

/**
 * The faces the brands' own sites actually load, read off their stylesheets.
 *
 * Bundled rather than fetched so a slide renders identically on a laptop and
 * on a serverless function, and so a font CDN being slow never costs a post.
 */
const FONT_FILES: Record<string, string> = {
  Fraunces: 'fraunces/files/fraunces-latin-400-normal.woff',
  Manrope: 'manrope/files/manrope-latin-400-normal.woff',
  'Instrument Serif': 'instrument-serif/files/instrument-serif-latin-400-normal.woff',
  'DM Sans': 'dm-sans/files/dm-sans-latin-400-normal.woff',
  'Chakra Petch': 'chakra-petch/files/chakra-petch-latin-400-normal.woff',
  Inter: 'inter/files/inter-latin-400-normal.woff',
  'Bricolage Grotesque': 'bricolage-grotesque/files/bricolage-grotesque-latin-400-normal.woff',
  Geist: 'geist-sans/files/geist-sans-latin-400-normal.woff',
  'JetBrains Mono': 'jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff',
  'IBM Plex Sans': 'ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff',
}

/** Faces we ship. A brand asking for anything else falls back rather than failing. */
export const AVAILABLE_FONTS = Object.keys(FONT_FILES)

export function resolveFont(requested: string, fallback: string): string {
  return FONT_FILES[requested] ? requested : fallback
}

async function loadFont(family: string): Promise<Buffer> {
  const file = FONT_FILES[family]
  if (!file) throw new Error(`No font file bundled for ${family}`)
  return readFile(path.join(process.cwd(), 'node_modules/@fontsource', file))
}

/**
 * Headline size for the amount of text.
 *
 * A fixed size either clips a long line or leaves a short one looking lost.
 * The steps are deliberately coarse — within a carousel most slides land on
 * the same size, so the set still reads as one design.
 */
export function headlineSize(text: string): number {
  const n = text.length
  if (n <= 24) return 96
  if (n <= 44) return 78
  if (n <= 70) return 64
  if (n <= 100) return 52
  return 44
}

/**
 * Compose one slide.
 *
 * Square by default: it is the shape every platform accepts and the shape a
 * carousel is read in.
 */
export async function renderSlide(
  brand: SlideBrand,
  content: SlideContent,
  size = 1080,
): Promise<Buffer> {
  const display = resolveFont(brand.displayFont, 'Fraunces')
  const body = resolveFont(brand.bodyFont, 'Manrope')

  const [displayData, bodyData] = await Promise.all([loadFont(display), loadFont(body)])

  const pad = Math.round(size * 0.11)

  // satori accepts a plain virtual-DOM object. Its published type is
  // ReactNode, which does not describe that shape, so the tree is cast once
  // here rather than pretending to build real React elements.
  const tree = {
      type: 'div',
      props: {
        style: {
          width: size,
          height: size,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: brand.colours.background,
          padding: pad,
          fontFamily: body,
        },
        children: [
          // Step marker, top left. Small, quiet, tells the reader where they are.
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                fontSize: Math.round(size * 0.022),
                letterSpacing: Math.round(size * 0.004),
                textTransform: 'uppercase',
                color: brand.colours.accent,
                fontFamily: body,
              },
              children: content.step ?? '',
            },
          },
          // The line itself.
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      fontSize: headlineSize(content.headline) * (size / 1080),
                      lineHeight: 1.12,
                      color: brand.colours.text,
                      fontFamily: display,
                    },
                    children: content.headline,
                  },
                },
                ...(content.body
                  ? [{
                      type: 'div',
                      props: {
                        style: {
                          display: 'flex',
                          marginTop: Math.round(size * 0.035),
                          fontSize: Math.round(size * 0.031),
                          lineHeight: 1.45,
                          color: brand.colours.accent,
                          fontFamily: body,
                        },
                        children: content.body,
                      },
                    }]
                  : []),
              ],
            },
          },
          // Footer keeps the logo's row even when there is no logo, so slides
          // with and without one share the same layout.
          {
            type: 'div',
            props: {
              style: { display: 'flex', height: Math.round(size * 0.06) },
              children: '',
            },
          },
        ],
      },
  }

  const svg = await satori(
    tree as unknown as Parameters<typeof satori>[0],
    {
      width: size,
      height: size,
      fonts: [
        { name: display, data: displayData, weight: 400, style: 'normal' },
        { name: body, data: bodyData, weight: 400, style: 'normal' },
      ],
    },
  )

  let image = sharp(Buffer.from(svg)).png()

  if (brand.logo) {
    try {
      const logoWidth = Math.round(size * 0.11)
      const logo = await prepareLogo(brand.logo, logoWidth, brand.colours.background)
      const meta = await sharp(logo).metadata()
      image = sharp(
        await image
          .composite([{
            input: logo,
            left: size - (meta.width ?? logoWidth) - pad,
            top: size - (meta.height ?? logoWidth) - Math.round(pad * 0.75),
          }])
          .png()
          .toBuffer(),
      ).png()
    } catch {
      // A logo that will not decode costs the mark, never the slide.
    }
  }

  return image.toBuffer()
}

/**
 * Make a logo sit on the slide rather than on a white tile.
 *
 * Several of the brand logos are favicons with a solid white background. Left
 * alone they render as a white box stuck in the corner — which is what the
 * first branded batch looked like.
 */
export async function prepareLogo(
  logoBuffer: Buffer,
  width: number,
  background: string,
): Promise<Buffer> {
  const flattened = await sharp(logoBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { data, info } = flattened

  // Anything close to white becomes transparent, so a white-backed favicon
  // stops carrying its tile onto the slide.
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 244 && data[i + 1] > 244 && data[i + 2] > 244) data[i + 3] = 0
  }

  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .trim()
    .resize({ width, withoutEnlargement: false })
    .flatten({ background })
    .removeAlpha()
    .toBuffer()
    .then((flat) => sharp(flat).png().toBuffer())
    .catch(async () =>
      sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
        .png()
        .trim()
        .resize({ width, withoutEnlargement: false })
        .toBuffer(),
    )
}
