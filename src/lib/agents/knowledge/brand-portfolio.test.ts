import assert from 'node:assert/strict'
import test from 'node:test'
import { getBrandPortfolioContext } from './brand-portfolio.ts'

test('Scent Sell portfolio is the fragrance marketplace, not seggs.life', () => {
  const context = getBrandPortfolioContext('scent-sell')
  assert.ok(context)
  assert.match(context!, /fragrance marketplace/i)
  assert.match(context!, /scentsell\.com\.au/i)
  assert.doesNotMatch(context!, /seggs\.life/i)
  assert.doesNotMatch(context!, /Erotic Blueprint/i)
})

test('Underground Parfums portfolio is the indie house with memory-first voice', () => {
  const context = getBrandPortfolioContext('underground-parfums')
  assert.ok(context)
  assert.match(context!, /small-batch/i)
  assert.match(context!, /Memory before note/i)
  assert.match(context!, /undergroundparfums\.com/i)
})
