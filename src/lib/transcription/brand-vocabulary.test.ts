import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  correctBrandName,
  correctBrandNameWithCount,
  deepgramKeywordParams,
  soundKey,
  soundsLikeBrand,
} from './brand-vocabulary'

const SCENTSELL = { canonical: 'ScentSell', terms: ['Sniffopotamus'] }

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
  assert.match(fixed, /It's Justin from ScentSell\./)
  assert.match(fixed, /fragrances on ScentSell/)
  assert.equal(correctBrandNameWithCount(REAL_TRANSCRIPT, SCENTSELL).corrections, 3)
})

test('a name split into two words is rejoined, not corrected twice', () => {
  const fixed = correctBrandName('I sell on Sent Sell every week.', SCENTSELL)
  assert.equal(fixed, 'I sell on ScentSell every week.')
})

test('the correct spelling is left exactly alone', () => {
  const already = 'ScentSell is an Australian marketplace.'
  assert.equal(correctBrandName(already, SCENTSELL), already)
  assert.equal(correctBrandNameWithCount(already, SCENTSELL).corrections, 0)
})

test('ordinary words that merely rhyme are not rewritten', () => {
  const text = 'The scent of it will sell itself, and the cell service is poor.'
  const fixed = correctBrandName(text, SCENTSELL)
  assert.equal(fixed, text, 'must not turn unrelated words into the brand name')
})

test('casing is always the brand\'s own, whatever the sentence did', () => {
  assert.equal(correctBrandName('sentel is good', SCENTSELL), 'ScentSell is good')
  assert.equal(correctBrandName('SENTEL is good', SCENTSELL), 'ScentSell is good')
})

test('surrounding punctuation and spacing survive', () => {
  assert.equal(
    correctBrandName('Try Sentel, then Sentel again — Sentel!', SCENTSELL),
    'Try ScentSell, then ScentSell again — ScentSell!',
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
  const target = soundKey('ScentSell')
  for (const heard of ['Sentel', 'Scentel', 'Sentell', 'Sentelle']) {
    assert.ok(soundsLikeBrand(soundKey(heard), target), `${heard} must match`)
  }
})

test('words that are merely nearby do not sound like the brand', () => {
  const target = soundKey('ScentSell')
  for (const other of ['Gumtree', 'sandal', 'scent', 'sell', 'cell', 'sensible', 'central']) {
    assert.ok(!soundsLikeBrand(soundKey(other), target), `${other} must NOT match`)
  }
})

test('the recogniser is told the brand words up front', () => {
  const params = deepgramKeywordParams(SCENTSELL)
  assert.match(params, /keywords=ScentSell%3A3/)
  assert.match(params, /keywords=Sniffopotamus%3A3/)
})

test('keyword boosting skips terms too short to help', () => {
  const params = deepgramKeywordParams({ canonical: 'ScentSell', terms: ['AU', 'Do'] })
  assert.doesNotMatch(params, /AU/)
  assert.match(params, /ScentSell/)
})
