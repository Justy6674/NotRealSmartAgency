import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractCandidates, mentionsPrompt, CORRECT_SILENTLY, WORTH_ASKING,
  type MentionReport,
} from './transcript-mentions'

/** The transcript that published "Birredo Blanche" under the owner's brand. */
const REAL = "Good morning. Today I have layered Mulan Cha and Birredo Blanche to nail "
  + 'that offensively clean aesthetic. Ormond Janes Bijous Saffron is another one I reach for.'

test('the names that went wrong are the ones picked out to check', () => {
  const found = extractCandidates(REAL)
  assert.ok(found.includes('Birredo Blanche'), `missed it: ${found.join(' | ')}`)
  assert.ok(found.includes('Mulan Cha'))
  assert.ok(found.includes('Ormond Janes Bijous Saffron'))
})

test('a sentence opening is not mistaken for a fragrance house', () => {
  // Otherwise every "Today" and "This morning" is checked against 75,000
  // bottles, and the real names get crowded out of the candidate list.
  const found = extractCandidates(REAL)
  assert.ok(!found.some((c) => c.startsWith('Today ')), `sentence opener kept: ${found.join(' | ')}`)
  assert.ok(!found.includes('Good morning'))
})

test('single capitalised words are left alone', () => {
  // "Blanche" on its own is too thin to resolve and would match half the
  // catalogue; a house-plus-name pair is the shape worth checking.
  assert.deepEqual(extractCandidates('I wore Blanche today. It was Nice.'), [])
})

test('a full stop cannot glue two names into one', () => {
  const found = extractCandidates('I love Byredo Blanche. Ormonde Jayne Zafran is next.')
  assert.ok(!found.some((c) => c.includes('Blanche Ormonde')), `glued: ${found.join(' | ')}`)
})

test('the candidate list is capped, so one clip cannot fire off a hundred queries', () => {
  const many = Array.from({ length: 40 }, (_, i) => `Alpha Beta${i}`).join('. ')
  assert.ok(extractCandidates(many).length <= 12)
})

test('a confirmed name is given as a replacement instruction, not a suggestion', () => {
  const report: MentionReport = {
    confirmed: [{ heard: 'Birredo Blanche', canonical: 'Byredo Blanche', score: 0.61 }],
    uncertain: [], unknown: [], catalogueChecked: true,
  }
  const prompt = mentionsPrompt(report)!
  assert.match(prompt, /heard "Birredo Blanche" → write "Byredo Blanche"/)
  assert.match(prompt, /exactly, every time/)
})

test('an uncertain name is forbidden outright, guesses included', () => {
  const report: MentionReport = {
    confirmed: [],
    uncertain: [{ heard: 'Mulan Cha', suggestions: ['Western Valley Mulan Rouge'] }],
    unknown: [], catalogueChecked: true,
  }
  const prompt = mentionsPrompt(report)!
  assert.match(prompt, /Do NOT write any of them/)
  // The near miss is the dangerous case: it is plausible enough to publish.
  assert.match(prompt, /do not write your best guess/)
})

test('nothing is claimed when the catalogue could not be reached', () => {
  // Silence beats "all clear" — an unreachable catalogue verified nothing.
  assert.equal(mentionsPrompt({ confirmed: [], uncertain: [], unknown: [], catalogueChecked: false }), null)
})

test('a clean transcript produces no instructions at all', () => {
  assert.equal(mentionsPrompt({ confirmed: [], uncertain: [], unknown: [], catalogueChecked: true }), null)
})

test('the correction bar sits above the asking bar, and both below certainty', () => {
  assert.ok(WORTH_ASKING < CORRECT_SILENTLY, 'a name worth asking about must not be auto-written')
  assert.ok(CORRECT_SILENTLY < 1, 'an exact match is not the only acceptable correction')
})
