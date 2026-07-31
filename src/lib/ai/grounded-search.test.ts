import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groundedSearchAvailable } from './grounded-search'

/**
 * Verification must fail SAFE. When no free grounded search is configured, the
 * answer has to be "I could not check" — never a verdict formed from memory,
 * because a confident memory is exactly what invented "Bijou Saffron" and then
 * "Bijou Zafran" from the same garbled transcript.
 */

test('reports unavailable when no key is configured', () => {
  assert.equal(groundedSearchAvailable({}), false)
})

test('reports available once a key is configured', () => {
  assert.equal(groundedSearchAvailable({ GOOGLE_GENERATIVE_AI_API_KEY: 'AIza-test' }), true)
})
