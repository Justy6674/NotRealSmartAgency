import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planCollage, COLLAGE_PRESETS } from './collage'

/**
 * A collage is a single image containing several pictures. A carousel is
 * several images the viewer swipes. Only the carousel existed, so asking for a
 * collage quietly produced the wrong thing.
 */

test('two images sit side by side', () => {
  const plan = planCollage(2)
  assert.equal(plan.cells.length, 2)
  assert.equal(new Set(plan.cells.map((c) => c.top)).size, 1, 'both on one row')
})

test('four images make a 2x2, not a single column', () => {
  const plan = planCollage(4)
  assert.equal(new Set(plan.cells.map((c) => c.left)).size, 2, 'two columns')
  assert.equal(new Set(plan.cells.map((c) => c.top)).size, 2, 'two rows')
})

test('cells never overflow the canvas', () => {
  for (const count of [2, 3, 4, 5, 6, 7, 8, 9]) {
    const plan = planCollage(count)
    for (const cell of plan.cells) {
      assert.ok(cell.left >= 0, `${count}: left off canvas`)
      assert.ok(cell.top >= 0, `${count}: top off canvas`)
      assert.ok(cell.left + cell.width <= plan.width, `${count}: runs off the right`)
      assert.ok(cell.top + cell.height <= plan.height, `${count}: runs off the bottom`)
    }
  }
})

test('cells never overlap each other', () => {
  for (const count of [2, 3, 4, 5, 6, 9]) {
    const { cells } = planCollage(count)
    for (let a = 0; a < cells.length; a++) {
      for (let b = a + 1; b < cells.length; b++) {
        const overlaps =
          cells[a].left < cells[b].left + cells[b].width &&
          cells[b].left < cells[a].left + cells[a].width &&
          cells[a].top < cells[b].top + cells[b].height &&
          cells[b].top < cells[a].top + cells[a].height
        assert.ok(!overlaps, `${count} images: cells ${a} and ${b} overlap`)
      }
    }
  }
})

test('a short final row is centred, not left-aligned', () => {
  // 5 images across 3 columns leaves a row of 2 that should be centred.
  const plan = planCollage(5)
  const rows = new Map<number, typeof plan.cells>()
  for (const cell of plan.cells) {
    rows.set(cell.top, [...(rows.get(cell.top) ?? []), cell])
  }
  const shortRow = [...rows.values()].find((row) => row.length < 3)
  assert.ok(shortRow, 'expected a short final row')
  const leftGap = shortRow![0].left
  const rightGap = plan.width - (shortRow![shortRow!.length - 1].left + shortRow![0].width)
  assert.ok(Math.abs(leftGap - rightGap) <= 2, `not centred: ${leftGap} vs ${rightGap}`)
})

test('each shape uses its own canvas', () => {
  assert.equal(planCollage(4, 'square').height, COLLAGE_PRESETS.square.height)
  assert.equal(planCollage(4, 'story').height, COLLAGE_PRESETS.story.height)
})

test('a collage of one, or of too many, is refused with a reason', () => {
  assert.throws(() => planCollage(1), /at least 2/)
  assert.throws(() => planCollage(10), /at most 9/)
})

test('an unverified product is never safe to publish', async () => {
  const { UNVERIFIED_RESULT } = await import('../agents/tools/verify-product')
  assert.equal(UNVERIFIED_RESULT.safe_to_publish, false)
  assert.equal(UNVERIFIED_RESULT.verdict, 'uncertain')
  assert.equal(UNVERIFIED_RESULT.canonical_name, null)
})
