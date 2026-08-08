import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  startBrief, currentStep, isOpen, applyAnswer, stalled, stepBrief,
} from './video-brief'

const fresh = () => startBrief('clip-1', '2026-08-08T04:00:00Z')

test('the questions come in order, one at a time', () => {
  let state = fresh()
  assert.equal(currentStep(state), 'captions')
  state = applyAnswer(state, { captions: true, trim: false })
  assert.equal(currentStep(state), 'feel')
  state = applyAnswer(state, { feel: 'dry and funny' })
  assert.equal(currentStep(state), 'platforms')
  state = applyAnswer(state, { platforms: ['Instagram'] })
  assert.equal(currentStep(state), 'writing')
})

test('"no captions" is an answer, not an unanswered question', () => {
  // false and null are the same value to a truthiness check, which would have
  // re-asked the captions question forever for anyone who said no.
  const state = applyAnswer(fresh(), { captions: false, trim: false })
  assert.equal(currentStep(state), 'feel')
})

test('"just captions" settles both things that were offered', () => {
  // Captions and trimming are offered in one question, so a reply choosing one
  // has declined the other. Waiting for a separate "no" to trimming would ask
  // a question the owner has already answered.
  const state = applyAnswer(fresh(), { captions: true })
  assert.equal(state.captions, true)
  assert.equal(state.trim, false)
  assert.equal(currentStep(state), 'feel')
})

test('asking only to trim does not quietly turn captions on', () => {
  const state = applyAnswer(fresh(), { trim: true })
  assert.equal(state.trim, true)
  assert.equal(state.captions, false)
})

test('an answer to a question that was not asked is ignored', () => {
  // Otherwise a stray "instagram" early on silently answers step three, and
  // the owner is never asked where the post is going.
  const state = applyAnswer(fresh(), { platforms: ['Instagram'] })
  assert.equal(currentStep(state), 'captions')
  assert.equal(state.platforms, null)
})

test('a reply that answers nothing leaves the step where it was', () => {
  const before = fresh()
  const after = applyAnswer(before, {})
  assert.ok(stalled(before, after), 'must be recognised as no answer at all')
  assert.equal(currentStep(after), 'captions')
})

test('an empty platform list does not count as choosing platforms', () => {
  const state = applyAnswer(applyAnswer(fresh(), { captions: true }), { feel: 'warm' })
  const after = applyAnswer(state, { platforms: [] })
  assert.ok(stalled(state, after))
  assert.equal(currentStep(after), 'platforms')
})

test('whitespace is not a feel', () => {
  const state = applyAnswer(fresh(), { captions: true })
  assert.ok(stalled(state, applyAnswer(state, { feel: '   ' })))
})

test('the brief closes only once the copy exists', () => {
  let state = fresh()
  state = applyAnswer(state, { captions: true, trim: true })
  state = applyAnswer(state, { feel: 'straight recommendation' })
  state = applyAnswer(state, { platforms: ['Instagram', 'Facebook'] })
  assert.ok(isOpen(state), 'still open — nothing has been written yet')
  state = { ...state, proposedOutputId: 'out-1' }
  assert.equal(currentStep(state), 'done')
  assert.equal(isOpen(state), false)
})

test('only the connected platforms are ever named', () => {
  // Scent Sell has Instagram, Facebook and YouTube. Offering TikTok is how a
  // whole draft fails on the one account that does not exist.
  const brief = stepBrief('platforms', {
    summary: '', canCaption: true, brandName: 'Scent Sell',
    platforms: ['Facebook', 'Instagram', 'YouTube'],
  })!
  assert.match(brief, /Facebook, Instagram, YouTube/)
  assert.ok(!/TikTok/i.test(brief))
  assert.match(brief, /no others/)
})

test('a clip with no speech is told the truth about captions', () => {
  const silent = stepBrief('captions', {
    summary: '', canCaption: false, brandName: 'Scent Sell', platforms: [],
  })!
  assert.match(silent, /could not make out any speech/)
  // And it must not offer a logo overlay, which does not exist for video.
  assert.match(silent, /not built yet/)
  const spoken = stepBrief('captions', {
    summary: 'a transcript', canCaption: true, brandName: 'Scent Sell', platforms: [],
  })!
  assert.match(spoken, /on mute/)
})

test('each step asks for exactly one thing', () => {
  for (const step of ['captions', 'feel', 'platforms'] as const) {
    const brief = stepBrief(step, {
      summary: 'x', canCaption: true, brandName: 'Scent Sell', platforms: ['Instagram'],
    })!
    assert.match(brief, /ONE question/, `${step} does not insist on a single question`)
  }
})
