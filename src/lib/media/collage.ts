/**
 * Composite several images into ONE image — a collage.
 *
 * A carousel and a collage are different things and were being conflated. A
 * carousel is N images the viewer swipes through; a collage is a single image
 * with several pictures laid out inside it. Only the carousel existed, so a
 * request for a collage quietly produced a carousel instead.
 *
 * Built on sharp, which is already a dependency — no new service, nothing to
 * pay for, and it runs in the same Node runtime as the rest of the pipeline.
 */

import sharp from 'sharp'

/** Instagram's portrait frame — the most forgiving default for a feed collage. */
export const COLLAGE_PRESETS = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1080, height: 566 },
} as const

export type CollageShape = keyof typeof COLLAGE_PRESETS

export interface CollageCell {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Work out where each picture sits.
 *
 * Chooses the grid that stays closest to square cells, so pictures are cropped
 * as little as possible: 2 side by side, 3 as a row, 4 as a 2×2, and so on.
 * The gutter is drawn as background showing between cells, and the same gutter
 * runs around the outside so nothing is flush to the edge.
 */
export function planCollage(
  count: number,
  shape: CollageShape = 'portrait',
  gutter = 16,
): { cells: CollageCell[]; width: number; height: number } {
  if (count < 2) throw new Error('A collage needs at least 2 images.')
  if (count > 9) throw new Error('A collage takes at most 9 images — use a carousel for more.')

  const { width, height } = COLLAGE_PRESETS[shape]

  // Pick the column count whose resulting cells are closest to square.
  let best = { columns: 1, score: Infinity }
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns)
    const cellWidth = (width - gutter * (columns + 1)) / columns
    const cellHeight = (height - gutter * (rows + 1)) / rows
    if (cellWidth <= 0 || cellHeight <= 0) continue
    // Distance from square, plus a nudge against leaving big holes in the grid.
    const score = Math.abs(cellWidth / cellHeight - 1) + (columns * rows - count) * 0.15
    if (score < best.score) best = { columns, score }
  }

  const columns = best.columns
  const rows = Math.ceil(count / columns)
  const cellWidth = Math.floor((width - gutter * (columns + 1)) / columns)
  const cellHeight = Math.floor((height - gutter * (rows + 1)) / rows)

  const cells: CollageCell[] = []
  for (let index = 0; index < count; index++) {
    const row = Math.floor(index / columns)
    const column = index % columns
    const itemsInRow = Math.min(columns, count - row * columns)

    // A short final row is centred rather than left-aligned, which reads as
    // deliberate instead of looking like a missing picture.
    const rowWidth = itemsInRow * cellWidth + (itemsInRow - 1) * gutter
    const rowLeft = Math.floor((width - rowWidth) / 2)

    cells.push({
      left: rowLeft + column * (cellWidth + gutter),
      top: gutter + row * (cellHeight + gutter),
      width: cellWidth,
      height: cellHeight,
    })
  }

  return { cells, width, height }
}

/**
 * Build the collage.
 *
 * Each picture is cover-cropped to its cell so it fills the space without
 * distortion — a squashed photo looks worse than a cropped one.
 */
export async function buildCollage({
  images,
  shape = 'portrait',
  background = '#faf4ec',
  gutter = 16,
}: {
  /** Raw image bytes, in the order they should appear. */
  images: Buffer[]
  shape?: CollageShape
  /** Shown in the gutters — set it to the brand's colour. */
  background?: string
  gutter?: number
}): Promise<Buffer> {
  const { cells, width, height } = planCollage(images.length, shape, gutter)

  const composites = await Promise.all(
    images.map(async (buffer, index) => {
      const cell = cells[index]
      const resized = await sharp(buffer)
        .resize(cell.width, cell.height, { fit: 'cover', position: 'attention' })
        .toBuffer()
      return { input: resized, left: cell.left, top: cell.top }
    }),
  )

  return sharp({
    create: { width, height, channels: 4, background },
  })
    .composite(composites)
    .png()
    .toBuffer()
}
