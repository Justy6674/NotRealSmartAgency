import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractNamedProductCandidates,
  validateScentSellProductClaims,
} from './scent-sell-product-gate'

test('extracts a likely named bottle without treating ordinary ScentSell copy as a product', () => {
  assert.deepEqual(extractNamedProductCandidates('Discover Dior Sauvage at Scent Sell.'), ['Dior Sauvage'])
  assert.deepEqual(extractNamedProductCandidates('Find your next fragrance at Scent Sell.'), [])
})

test('does not block a generic title-cased campaign heading as a named bottle', async () => {
  let lookedUp = false
  const result = await validateScentSellProductClaims(
    'scent-sell',
    'New Arrivals Today at Scent Sell.',
    async () => {
      lookedUp = true
      return { verdict: 'not_found', near: [] }
    },
  )
  assert.equal(lookedUp, false)
  assert.equal(result.allowed, true)
})

test('blocks a ScentSell named claim that the catalogue cannot confirm', async () => {
  const result = await validateScentSellProductClaims(
    'scent-sell',
    'Discover Dior Totally Invented.',
    async () => ({ verdict: 'not_found', near: [] }),
  )
  assert.equal(result.allowed, false)
  assert.match(result.reason ?? '', /not confirmed/i)
})

test('allows a catalogue-confirmed product and records the canonical spelling', async () => {
  const result = await validateScentSellProductClaims(
    'scent-sell',
    'Discover Dior Sauvage.',
    async () => ({
      verdict: 'exists',
      canonical: 'Dior Sauvage',
      match: { brand: 'Dior', name: 'Sauvage', concentration: null, scent_family: null, perfumer: null },
    }),
  )
  assert.deepEqual(result, {
    allowed: true,
    candidates: ['Dior Sauvage'],
    verified: ['Dior Sauvage'],
  })
})
