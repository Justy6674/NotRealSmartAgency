import assert from 'node:assert/strict'
import test from 'node:test'
import { extractExplicitFounderLearnings } from './founder-learning.ts'

test('stores a founder correction as project learning', () => {
  assert.deepEqual(
    extractExplicitFounderLearnings('Remember that Do Today is national and not only for Downscale patients.'),
    [{
      fact: 'Do Today is national and not only for Downscale patients.',
      type: 'brand_rule',
      confidence: 1,
      tags: ['founder-stated', 'explicit-memory'],
    }],
  )
})

test('does not turn an ordinary request into permanent learning', () => {
  assert.deepEqual(extractExplicitFounderLearnings('Build this week’s marketing plan.'), [])
})
