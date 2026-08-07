import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  correctBrandName,
  correctBrandNameWithCount,
  deepgramKeywordParams,
  soundKey,
  soundsLikeBrand,
} from './brand-vocabulary'

const SCENTSELL = {
  canonical: 'Scent Sell',
  terms: ['Sniffopotamus'],
  never: ['ScentSell', 'Scentsell', 'SENSEL', 'Sentel', 'Sentell', 'Scentel', 'Scent Sail', 'Scent Cell'],
}

/**
 * The real transcript that caused this. Deepgram heard "Sentel" and "Scentel"
 * for ScentSell, and every caption written from it repeated the mistake back to
 * the owner about his own company.
 */
const REAL_TRANSCRIPT =
  "Hey. It's Justin from Sentel. And, Rhett, she's the best sniffer in the business. " +
  'Sentel, we are a marketplace. So, that\'s a secondhand marketplace, a bit like, say, Gumtree ' +
  'or something. So, what that means is that sellers can put their own fragrances on Scentel ' +
  'and sell it directly to another buyer.'

test('the real mis-heard transcript comes out with the brand spelled correctly', () => {
  const fixed = correctBrandName(REAL_TRANSCRIPT, SCENTSELL)
  assert.doesNotMatch(fixed, /Sentel/)
  assert.doesNotMatch(fixed, /Scentel\b/)
  assert.match(fixed, /It's Justin from Scent Sell\./)
  assert.match(fixed, /fragrances on Scent Sell/)
  assert.equal(correctBrandNameWithCount(REAL_TRANSCRIPT, SCENTSELL).corrections, 3)
})

test('a name split into two words is rejoined, not corrected twice', () => {
  const fixed = correctBrandName('I sell on Sent Sell every week.', SCENTSELL)
  assert.equal(fixed, 'I sell on Scent Sell every week.')
})

test('the correct spelling is left exactly alone', () => {
  const already = 'Scent Sell is an Australian marketplace.'
  assert.equal(correctBrandName(already, SCENTSELL), already)
  assert.equal(correctBrandNameWithCount(already, SCENTSELL).corrections, 0)
})

test('ordinary words that merely rhyme are not rewritten', () => {
  const text = 'The scent of it will sell itself, and the cell service is poor.'
  const fixed = correctBrandName(text, SCENTSELL)
  assert.equal(fixed, text, 'must not turn unrelated words into the brand name')
})

test('casing is always the brand\'s own, whatever the sentence did', () => {
  assert.equal(correctBrandName('sentel is good', SCENTSELL), 'Scent Sell is good')
  assert.equal(correctBrandName('SENTEL is good', SCENTSELL), 'Scent Sell is good')
})

test('surrounding punctuation and spacing survive', () => {
  assert.equal(
    correctBrandName('Try Sentel, then Sentel again — Sentel!', SCENTSELL),
    'Try Scent Sell, then Scent Sell again — Scent Sell!',
  )
})

test('a short or empty brand name is left well alone', () => {
  // Too short to be distinctive: matching on sound would rewrite half the text.
  const text = 'Do today we go to the shop today.'
  assert.equal(correctBrandName(text, { canonical: 'Do', terms: [] }), text)
  assert.equal(correctBrandName(text, { canonical: '', terms: [] }), text)
})

test('an empty transcript is handled without throwing', () => {
  assert.equal(correctBrandName('', SCENTSELL), '')
})

test('the mis-hearings that caused this all sound like the brand', () => {
  const target = soundKey('Scent Sell')
  for (const heard of ['Sentel', 'Scentel', 'Sentell', 'Sentelle']) {
    assert.ok(soundsLikeBrand(soundKey(heard), target), `${heard} must match`)
  }
})

test('words that are merely nearby do not sound like the brand', () => {
  const target = soundKey('Scent Sell')
  for (const other of ['Gumtree', 'sandal', 'scent', 'sell', 'cell', 'sensible', 'central']) {
    assert.ok(!soundsLikeBrand(soundKey(other), target), `${other} must NOT match`)
  }
})

test('the recogniser is told the brand words up front', () => {
  const params = deepgramKeywordParams(SCENTSELL)
  assert.match(params, /keywords=Scent%20Sell%3A3/)
  assert.match(params, /keywords=Sniffopotamus%3A3/)
})

test('keyword boosting skips terms too short to help', () => {
  const params = deepgramKeywordParams({ canonical: 'Scent Sell', terms: ['AU', 'Do'] })
  assert.doesNotMatch(params, /AU/)
  assert.match(params, /Scent%20Sell/)
})

/**
 * "ScentSell" and "Scent Sell" sound identical, so no phonetic rule can choose
 * between them. Only the owner can, and he did: the wordmark is two words.
 */
test('a run-together spelling the owner forbade is corrected to his wordmark', () => {
  assert.equal(
    correctBrandName('Buy it on ScentSell today.', SCENTSELL),
    'Buy it on Scent Sell today.',
  )
  assert.equal(correctBrandName('SENSEL is live', SCENTSELL), 'Scent Sell is live')
})

test('a forbidden two-word spelling is corrected as one unit', () => {
  assert.equal(correctBrandName('Jump on Scent Cell now', SCENTSELL), 'Jump on Scent Sell now')
  assert.equal(correctBrandName('Try Scent Sail today', SCENTSELL), 'Try Scent Sell today')
})

test('the wordmark itself is never rewritten', () => {
  const good = 'Scent Sell is the marketplace, and Scent Sell is Australian.'
  assert.equal(correctBrandName(good, SCENTSELL), good)
})

test('the brand words still reach the recogniser as one phrase', () => {
  assert.match(deepgramKeywordParams(SCENTSELL), /keywords=Scent%20Sell%3A3/)
})
