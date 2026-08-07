import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyBrandFence, fenceAllows, readBrandFence } from './project-fence'

const grants = [
  { projectId: 'scentsell', name: 'ScentSell' },
  { projectId: 'telescribe', name: 'TeleScribe' },
  { projectId: 'tele360', name: 'Tele360' },
]

test('no fence means every granted project', () => {
  assert.equal(readBrandFence(null), null)
  assert.equal(readBrandFence(undefined), null)
  assert.equal(readBrandFence([]), null)
  assert.equal(applyBrandFence(grants, null).length, 3)
})

test('a fence keeps only what it names', () => {
  const kept = applyBrandFence(grants, ['scentsell'])
  assert.deepEqual(kept.map((g) => g.projectId), ['scentsell'])
})

test('a fence naming several projects keeps all of them, in order', () => {
  const kept = applyBrandFence(grants, ['tele360', 'scentsell'])
  assert.deepEqual(kept.map((g) => g.projectId), ['scentsell', 'tele360'])
})

test('a fence naming a project that was never granted grants nothing extra', () => {
  const kept = applyBrandFence(grants, ['scentsell', 'a-project-not-granted'])
  assert.deepEqual(kept.map((g) => g.projectId), ['scentsell'])
})

test('rubbish in the column does not silently open the fence', () => {
  // A non-string entry must not widen access; a list of only rubbish is
  // treated as no usable fence, which is the same as the column being unset.
  assert.deepEqual(applyBrandFence(grants, ['scentsell', 42, null]).map((g) => g.projectId), ['scentsell'])
  assert.equal(readBrandFence([42, null]), null)
})

test('a single project is checked on the way in, not just on the way out', () => {
  assert.equal(fenceAllows(['scentsell'], 'scentsell'), true)
  assert.equal(fenceAllows(['scentsell'], 'tele360'), false)
  assert.equal(fenceAllows(null, 'tele360'), true)
})

test('the fence never mutates what it was given', () => {
  const original = [...grants]
  applyBrandFence(grants, ['scentsell'])
  assert.deepEqual(grants, original)
})
