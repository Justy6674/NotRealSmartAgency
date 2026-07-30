import assert from 'node:assert/strict'
import test from 'node:test'
import { getBrandPortfolioContext } from './brand-portfolio.ts'

test('Scent Sell portfolio is the fragrance marketplace, not seggs.life', () => {
  const context = getBrandPortfolioContext('scent-sell')
  assert.ok(context)
  assert.match(context!, /fragrance marketplace/i)
  assert.match(context!, /scentsell\.com\.au/i)

  // The context deliberately names seggs.life in order to rule it out — the two
  // brands were being confused, and an explicit "NOT seggs.life" is what stops
  // it. A bare doesNotMatch cannot tell "mentions X" from "says it is not X",
  // so it failed on the very sentence that fixes the problem. Assert the
  // disclaimer instead, and that nothing describes Scent Sell AS that product.
  assert.match(context!, /not\s+seggs\.life/i)
  assert.doesNotMatch(context!, /Erotic Blueprint/i)
  assert.doesNotMatch(context!, /Scent Sell is an intimacy/i)
})

test('Underground Parfums portfolio is the indie house with memory-first voice', () => {
  const context = getBrandPortfolioContext('underground-parfums')
  assert.ok(context)
  assert.match(context!, /small-batch/i)
  assert.match(context!, /Memory before note/i)
  assert.match(context!, /undergroundparfums\.com/i)
})
