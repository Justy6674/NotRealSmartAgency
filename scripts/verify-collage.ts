/**
 * Build a real collage from real brand images and write it out, so the layout
 * can be looked at rather than assumed correct.
 *
 * Usage: npx tsx scripts/verify-collage.ts <outPath> <url> <url> [...]
 */
import { writeFileSync } from 'fs'
import { buildCollage, planCollage } from '@/lib/media/collage'

async function main() {
  const [, , outPath, ...urls] = process.argv
  if (!outPath || urls.length < 2) {
    console.error('Usage: npx tsx scripts/verify-collage.ts <outPath> <url> <url> [...]')
    process.exit(1)
  }

  for (const n of [2, 3, 4, 5, 6, 9]) {
    const plan = planCollage(n)
    const columns = new Set(plan.cells.map((c) => c.left)).size
    console.log(`${n} images -> ${plan.cells.length} cells, ${columns} columns, ${plan.width}x${plan.height}`)
  }

  const images = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`could not fetch ${url}`)
      return Buffer.from(await res.arrayBuffer())
    }),
  )

  const out = await buildCollage({ images, shape: 'portrait', background: '#faf4ec' })
  writeFileSync(outPath, out)
  console.log(`\nWrote ${outPath} (${out.length} bytes) from ${images.length} images`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
