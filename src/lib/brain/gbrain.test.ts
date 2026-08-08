import { test } from 'node:test'
import assert from 'node:assert/strict'
import { brainConfigured, brainContext, searchBrain, type BrainHit } from './gbrain'

/**
 * The Director had a memory and it was the wrong brain.
 *
 * Every serious failure on 8 August 2026 was already written down in gbrain
 * and unreadable: "Scent Sell must never change fragrance names", "must use
 * properly researched fragrance descriptions, not made-up ones", "require
 * founder approval before publishing". All three were violated that day.
 */

const hit = (slug: string, excerpt: string): BrainHit =>
  ({ slug, title: 'T', type: 'reference', excerpt, rank: 1, updatedAt: null })

test('a missing connection is reported, never treated as an empty brain', () => {
  // "Nothing found" and "not connected" mean opposite things to whoever reads
  // it, and confusing them would let the Director answer from instinct while
  // believing the brain had nothing to say.
  assert.equal(brainConfigured({}), false)
  assert.equal(brainConfigured({ GBRAIN_DATABASE_URL: '' }), false)
  assert.equal(brainConfigured({ GBRAIN_DATABASE_URL: 'postgres://x' }), true)
})

test('an unconfigured brain returns nothing rather than throwing', () => {
  // A brain lookup must never take the reply down with it.
  return searchBrain('anything', { env: {} }).then((hits) => assert.deepEqual(hits, []))
})

test('an empty question is not sent to the database', () => {
  return searchBrain('   ', { env: { GBRAIN_DATABASE_URL: 'postgres://unreachable' } })
    .then((hits) => assert.deepEqual(hits, []))
})

test('every line carries its slug, so a claim can be traced', () => {
  // His own rule: cite or it did not happen. A fact from the brain with no
  // pointer cannot be told apart from one the model invented.
  const context = brainContext([hit('reference/nrs/scentsell', 'never change fragrance names')])!
  assert.match(context, /\[reference\/nrs\/scentsell\]/)
  assert.match(context, /Cite the slug/)
})

test('the brain is stated to outrank the model, not merely inform it', () => {
  const context = brainContext([hit('a/b', 'x')])!
  assert.match(context, /outrank your own instincts/)
})

test('no hits produces no prompt block at all', () => {
  // An empty heading reads as "the brain says nothing", which is a claim.
  assert.equal(brainContext([]), null)
})
