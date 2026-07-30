import sharp from 'sharp'

/**
 * Put the brand's real logo on a generated image.
 *
 * Every generated image came back unbranded, because the prompt told the model
 * not to draw a logo — which was right, and incomplete. An image model asked
 * for a logo invents one, and an invented logo on a real account is worse than
 * none. The actual file has to be composited afterwards.
 *
 * Deliberately restrained: a small mark in a corner, never across the middle,
 * never scaled up past a tenth of the frame. The image is the message; the
 * logo is the signature.
 */

export type StampCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface StampOptions {
  /** Fraction of the image width the logo may occupy. */
  scale?: number
  /** Distance from the edges, as a fraction of image width. */
  margin?: number
  corner?: StampCorner
  /** 0-1. Slightly transparent so it sits on the image rather than on top of it. */
  opacity?: number
}

const DEFAULTS: Required<StampOptions> = {
  scale: 0.10,
  margin: 0.045,
  corner: 'bottom-right',
  opacity: 0.9,
}

export function stampPosition(
  corner: StampCorner,
  image: { width: number; height: number },
  logo: { width: number; height: number },
  margin: number,
): { left: number; top: number } {
  const m = Math.round(image.width * margin)
  const left = corner.endsWith('right') ? image.width - logo.width - m : m
  const top = corner.startsWith('bottom') ? image.height - logo.height - m : m

  // Never let a wide logo push off-frame on a small image.
  return {
    left: Math.max(0, Math.min(left, image.width - logo.width)),
    top: Math.max(0, Math.min(top, image.height - logo.height)),
  }
}

/**
 * Composite a logo onto an image, both supplied as buffers.
 *
 * Returns the original image untouched when the logo cannot be read — an
 * unbranded image is a shortfall, but a corrupted one is a broken post.
 */
export async function stampLogo(
  imageBuffer: Buffer,
  logoBuffer: Buffer,
  options: StampOptions = {},
): Promise<Buffer> {
  const { scale, margin, corner, opacity } = { ...DEFAULTS, ...options }

  const base = sharp(imageBuffer)
  const meta = await base.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (!width || !height) return imageBuffer

  try {
    const targetWidth = Math.max(24, Math.round(width * scale))

    // Trim the transparent border many favicons carry, so the mark is sized by
    // the logo itself rather than by its padding.
    const logo = await sharp(logoBuffer)
      .trim()
      .resize({ width: targetWidth, withoutEnlargement: false })
      .ensureAlpha()
      .composite([
        {
          input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer()

    const logoMeta = await sharp(logo).metadata()
    const position = stampPosition(
      corner,
      { width, height },
      { width: logoMeta.width ?? targetWidth, height: logoMeta.height ?? targetWidth },
      margin,
    )

    return await base
      .composite([{ input: logo, left: position.left, top: position.top }])
      .png()
      .toBuffer()
  } catch {
    // A logo that will not decode must not cost us the image.
    return imageBuffer
  }
}
