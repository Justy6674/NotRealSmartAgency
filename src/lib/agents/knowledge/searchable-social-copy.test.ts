import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSearchableSocialCopyRules } from './searchable-social-copy.ts'
import type { Brand } from '@/types/database'

const brand = {
  name: 'Scent Sell',
  niche: 'fragrance_marketplace',
  social_urls: { instagram: 'https://instagram.com/scentsell' },
  tone_of_voice: { keywords: ['fragrance', 'niche'], avoid_words: ['fake'], humour: 'moderate', formality: 'casual' },
  content_pillars: ['Fragrance reviews', 'Marketplace tips'],
  // A deliberate partial: these rules read five fields and the other twenty-nine
  // on Brand would be noise in the fixture. Cast through `unknown` because that
  // is what TypeScript asks for on a partial, not because the shape is unknown.
} as unknown as Brand

test('searchable social rules emphasise caption-body discovery and sparse hashtags', () => {
  const rules = buildSearchableSocialCopyRules(brand)
  assert.match(rules, /Scent Sell/)
  assert.match(rules, /CAPTION BODY/)
  assert.match(rules, /3–5 highly relevant hashtags/)
  assert.match(rules, /fragrance, niche/)
  assert.match(rules, /Never use: fake/)
})
