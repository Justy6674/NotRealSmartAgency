import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankMatches, spellingVariants, catalogueAvailable } from './fragrance-catalogue'

/**
 * These encode the mistake this file exists to prevent. A transcript said
 * "Ormond Janes, Bijous, Saffron". Reasoning produced "Bijou Saffron", which is
 * not a product. A web search could not settle it. The catalogue found
 * Ormonde Jayne **Bijou Zafran** — real, spelled with the Arabic Z, which is
 * exactly why every search for "saffron" missed it.
 */

const ROWS = [
  { brand: 'Ormonde Jayne', name: 'Bijou Zafran', concentration: null, scent_family: null, perfumer: null },
  { brand: 'Ormonde Jayne', name: 'Ormonde', concentration: null, scent_family: null, perfumer: null },
  { brand: 'General Cosmetics', name: 'Bijou', concentration: null, scent_family: null, perfumer: null },
  { brand: 'Bujairami', name: 'Saffron Inspired by Black Saffron Byredo', concentration: null, scent_family: null, perfumer: null },
  { brand: 'Byredo', name: 'Black Saffron', concentration: null, scent_family: null, perfumer: null },
]

test('zafran and saffron are treated as the same word', () => {
  assert.ok(spellingVariants('Bijou Zafran').some((v) => v.includes('saffron')))
  assert.ok(spellingVariants('Bijou Saffron').some((v) => v.includes('zafran')))
})

test('the real product outranks a house-named one', () => {
  const ranked = rankMatches('Ormonde Jayne Bijou Zafran', ROWS)
  assert.equal(ranked[0].name, 'Bijou Zafran', 'Ormonde Jayne "Ormonde" must not win on its own house name')
})

test('the real product outranks another house sharing one word', () => {
  const ranked = rankMatches('Ormonde Jayne Bijou Zafran', ROWS)
  assert.notEqual(ranked[0].brand, 'General Cosmetics')
})

test('the genuine article outranks an "Inspired by" knock-off', () => {
  const ranked = rankMatches('Byredo Black Saffron', ROWS)
  assert.equal(ranked[0].brand, 'Byredo')
  assert.equal(ranked[0].name, 'Black Saffron')
})

test('a query sharing nothing distinctive matches nothing', () => {
  assert.equal(rankMatches('Completely Unrelated Thing', ROWS).length, 0)
})

test('reports unavailable rather than guessing when unconfigured', () => {
  assert.equal(catalogueAvailable({}), false)
  assert.equal(
    catalogueAvailable({ FRAGRANCE_CATALOGUE_URL: 'https://x', FRAGRANCE_CATALOGUE_KEY: 'k' }),
    true,
  )
})
