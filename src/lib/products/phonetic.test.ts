import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fold, phoneticSimilarity, scoreAgainstEntry, searchTokens, editDistance } from './phonetic'

test('the three names that actually went wrong all resolve to the right bottle', () => {
  // Every one of these was published or offered wrong. They are the spec.
  const wulong = scoreAgainstEntry('Mulan Cha', 'Nishane', 'Wulong Cha')
  const byredo = scoreAgainstEntry('Birredo Blanche', 'Byredo', 'Blanche')
  const zafran = scoreAgainstEntry('Ormond Janes Bijous Saffron', 'Ormonde Jayne', 'Bijou Zafran')

  assert.ok(byredo >= 0.99, `Byredo Blanche should be a perfect sound match, got ${byredo}`)
  assert.ok(zafran >= 0.85, `Bijou Zafran should be near-certain, got ${zafran}`)
  assert.ok(wulong >= 0.7, `Wulong Cha should be a strong candidate, got ${wulong}`)
})

test('the right bottle outranks the wrong one that shares more letters', () => {
  // This is the whole point. A trigram index scores Mulan Rouge ABOVE Wulong
  // Cha, which is how "you've layered Mulan Cha" reached the owner.
  const right = scoreAgainstEntry('Mulan Cha', 'Nishane', 'Wulong Cha')
  const wrong = scoreAgainstEntry('Mulan Cha', 'Western Valley', 'Mulan Rouge')
  assert.ok(right > wrong, `wrong bottle won: ${right} vs ${wrong}`)
})

test('vowels are what the recogniser loses, so they fold together', () => {
  assert.equal(fold('Byredo'), fold('Birredo'))
  // A silent trailing "e" is one edit, not a different word.
  assert.ok(phoneticSimilarity('Ormonde', 'Ormond') > 0.8)
  // But the consonant frame is kept — it is what survives being mis-heard.
  assert.notEqual(fold('Blanche'), fold('Branche'))
})

test('letters that sound the same collapse; letters that do not, do not', () => {
  assert.equal(fold('Cha'), fold('Sha'), 'ch and sh are routinely swapped')
  assert.notEqual(fold('Cha'), fold('Ka'), 'but "Cha" is not "Ka"')
  assert.equal(fold('Philosykos'), fold('Filosykos'))
  assert.equal(fold('Zafran'), fold('Safran'))
})

test('a first letter that got lost does not sink the match', () => {
  // Soundex and Metaphone both key on the first letter, and the first letter
  // is exactly what goes: Wulong became Mulan, ScentSell became Sentel.
  assert.ok(phoneticSimilarity('Sentel', 'ScentSell') > 0.6)
  assert.ok(phoneticSimilarity('Mulan', 'Wulong') > 0.6)
})

test('an unrelated name never outscores the real one', () => {
  // Sound-folding is generous on purpose — it has to be, to survive a first
  // letter going missing. So the guarantee that matters is not an absolute
  // floor, it is the gap: the right bottle must win by a distance. Whole-word
  // overlap (see shareAWord in transcript-mentions) removes the rest.
  const real = scoreAgainstEntry('Birredo Blanche', 'Byredo', 'Blanche')
  const noise = scoreAgainstEntry('Birredo Blanche', 'Creed', 'Aventus')
  assert.ok(real - noise > 0.4, `not enough daylight: ${real} vs ${noise}`)
  assert.ok(scoreAgainstEntry('Mulan Cha', 'Tom Ford', 'Oud Wood') < 0.45)
})

test('a long garbled name is not matched on the house alone', () => {
  // Knowing it is an Ormonde Jayne does not tell us WHICH Ormonde Jayne, and a
  // house-level match dressed up as a product is how the wrong bottle ships.
  const houseOnly = scoreAgainstEntry('Ormond Janes Bijous Saffron', 'Ormonde Jayne', 'Ormonde Woman')
  const theRightOne = scoreAgainstEntry('Ormond Janes Bijous Saffron', 'Ormonde Jayne', 'Bijou Zafran')
  assert.ok(theRightOne > houseOnly + 0.2, `house-level match too close: ${houseOnly} vs ${theRightOne}`)
})

test('the words used to search are the ones worth searching for', () => {
  assert.deepEqual(searchTokens('Mulan Cha'), ['mulan', 'cha'])
  // Two letters matches half the catalogue and is not worth a query.
  assert.deepEqual(searchTokens('Le Labo Santal'), ['labo', 'santal'])
})

test('edit distance gives up cheaply on a hopeless pair', () => {
  assert.equal(editDistance('abc', 'abc'), 0)
  assert.equal(editDistance('abc', 'abd'), 1)
  assert.ok(editDistance('a', 'a'.repeat(80), 5) > 5, 'must bail rather than scan')
})
