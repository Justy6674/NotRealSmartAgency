import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enforceBrandName, remainingMistakes } from './enforce-name'

/** Scent Sell's real record. */
const SCENT_SELL = {
  name: 'Scent Sell',
  nameNever: ['ScentSell', 'Scentsell', 'SENSEL', 'Sensell', 'Sentel', 'Sentell',
    'Scentel', 'Scent Sail', 'Scent Cell', 'Sent Sell'],
}

test('the spelling that was published today is corrected', () => {
  // "Build your own, customise it, and share it free on ScentSell." — written
  // after a full day of work on this, with the spelling already listed as
  // forbidden in the brand record.
  const { text, corrected } = enforceBrandName(
    'Build your own, customise it, and share it free on ScentSell.',
    SCENT_SELL,
  )
  assert.equal(text, 'Build your own, customise it, and share it free on Scent Sell.')
  assert.deepEqual(corrected, ['ScentSell'])
})

test('THE WEBSITE IS NOT TOUCHED', () => {
  // scentsell.com.au is correct. Rewriting it breaks the link — worse than
  // the problem being fixed.
  const { text } = enforceBrandName(
    'Build yours free at www.scentsell.com.au or scentsell.com.au — ScentSell makes it easy.',
    SCENT_SELL,
  )
  assert.ok(text.includes('www.scentsell.com.au'), 'the URL must survive intact')
  assert.ok(text.includes('scentsell.com.au —'), 'the bare domain must survive too')
  assert.ok(text.includes('Scent Sell makes it easy'), 'the prose must still be corrected')
})

test('THE INSTAGRAM HANDLE IS NOT TOUCHED', () => {
  // @scentsellsocials is the real handle. Rewriting it tags a stranger.
  const { text } = enforceBrandName('Follow @scentsellsocials — Scentsell is free.', SCENT_SELL)
  assert.ok(text.includes('@scentsellsocials'))
  assert.ok(text.includes('Scent Sell is free'))
})

test('the hashtag is left alone', () => {
  const { text } = enforceBrandName('#ScentSell #fragrancecommunity', SCENT_SELL)
  assert.equal(text, '#ScentSell #fragrancecommunity')
})

test('an email address survives', () => {
  const { text } = enforceBrandName('Reach us at hello@scentsell.com.au', SCENT_SELL)
  assert.ok(text.includes('hello@scentsell.com.au'))
})

test('every listed misspelling is caught, whatever the case', () => {
  for (const wrong of ['ScentSell', 'Scentsell', 'SCENTSELL', 'Sentel', 'Scent Sail', 'Sent Sell']) {
    const { text } = enforceBrandName(`I love ${wrong} so much.`, SCENT_SELL)
    assert.equal(text, 'I love Scent Sell so much.', `missed: ${wrong}`)
  }
})

test('the correct spelling is left exactly as it is', () => {
  const original = 'Scent Sell is Australia\'s pre-owned fragrance marketplace.'
  const { text, corrected } = enforceBrandName(original, SCENT_SELL)
  assert.equal(text, original)
  assert.deepEqual(corrected, [])
})

test('a longer wrong name is not half-corrected by a shorter one', () => {
  // "Scent Sail" must not be matched as "Scent Sa" + "il" or left worse than
  // it started.
  const { text } = enforceBrandName('Try Scent Sail today.', SCENT_SELL)
  assert.equal(text, 'Try Scent Sell today.')
})

test('a brand with nothing forbidden is passed through untouched', () => {
  const original = 'Anything at all.'
  assert.equal(enforceBrandName(original, { name: 'X', nameNever: [] }).text, original)
  assert.equal(enforceBrandName('', SCENT_SELL).text, '')
})

test('remaining mistakes are reported, not swallowed', () => {
  assert.deepEqual(remainingMistakes('All good here, Scent Sell.', SCENT_SELL), [])
  // A URL is not a mistake.
  assert.deepEqual(remainingMistakes('Visit scentsell.com.au', SCENT_SELL), [])
  // Prose is.
  assert.deepEqual(remainingMistakes('Visit ScentSell', SCENT_SELL), ['ScentSell'])
})

test('correcting then re-checking leaves nothing behind', () => {
  const messy = 'ScentSell and Sentel and Scent Cell, see scentsell.com.au and @scentsellsocials.'
  const { text } = enforceBrandName(messy, SCENT_SELL)
  assert.deepEqual(remainingMistakes(text, SCENT_SELL), [])
  assert.ok(text.includes('scentsell.com.au') && text.includes('@scentsellsocials'))
})
