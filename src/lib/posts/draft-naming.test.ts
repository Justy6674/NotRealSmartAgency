import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The one place a draft is born is the one place the spelling must hold.
 *
 * A caption reaches here from the Director, from a tool, or from a hand edit.
 * Checking it in only one of those paths leaves the others free to publish
 * "ScentSell" to a customer — which is exactly what happened while that
 * spelling sat in the forbidden list on the brand's own record.
 */
const source = readFileSync(
  resolve(process.cwd(), 'src/lib/posts/create-draft.ts'),
  'utf8',
)

test('the caption written to the draft is the corrected one', () => {
  assert.match(source, /caption: correctedCaption/,
    'the raw caption must not be the one stored — the correction would be decorative')
  assert.ok(
    !/^\s*caption,$/m.test(source.slice(source.indexOf('const insertData'))),
    'the uncorrected caption must not reach the insert',
  )
})

test('the correction runs before the row is built', () => {
  const correction = source.indexOf('enforceBrandName(caption')
  const insert = source.indexOf('const insertData')
  assert.ok(correction > -1, 'no brand-name enforcement in the draft path')
  assert.ok(correction < insert, 'the correction must run before the row is assembled')
})

test('a mis-spelling is logged, not silently swallowed', () => {
  assert.match(source, /brand name corrected in caption/,
    'a silent correction hides how often the model gets it wrong')
})
