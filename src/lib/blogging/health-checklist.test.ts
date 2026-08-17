import assert from 'node:assert/strict'
import test from 'node:test'
import { healthChecklist, type HealthFlags } from './health-checklist.ts'

const HEALTH: HealthFlags = { ahpra: true, tga: true }
const SCENT: HealthFlags = { ahpra: false, tga: false }

test('an unregulated business gets no health checklist at all', () => {
  assert.deepEqual(healthChecklist(SCENT, { isValid: true, checkCompleted: true }), [])
})

test('a health business always sees the rules the owner would say out loud', () => {
  const items = healthChecklist(HEALTH, null)
  const labels = items.map((item) => item.label)
  assert.ok(labels.some((label) => /patient stor/i.test(label)))
  assert.ok(labels.some((label) => /promise/i.test(label)))
  assert.ok(labels.some((label) => /medicine/i.test(label)))
  assert.ok(items.every((item) => item.passed === false))
})

test('a completed pass ticks every item — she can paste without guessing', () => {
  const items = healthChecklist(HEALTH, { isValid: true, checkCompleted: true })
  assert.ok(items.length > 0)
  assert.ok(items.every((item) => item.passed))
})

test('an incomplete review never looks like a pass', () => {
  const items = healthChecklist(HEALTH, { isValid: true, checkCompleted: false })
  assert.ok(items.every((item) => item.passed === false))
})

test('TGA-only businesses still see the medicine rule; AHPRA-only skip it', () => {
  const tga = healthChecklist({ ahpra: false, tga: true }, { isValid: true, checkCompleted: true })
  const ahpra = healthChecklist({ ahpra: true, tga: false }, { isValid: true, checkCompleted: true })
  assert.ok(tga.some((item) => /medicine/i.test(item.label)))
  assert.ok(ahpra.every((item) => !/medicine/i.test(item.label)))
})

test('checklist copy never names AbeAI, Mixpost, or the corpus', () => {
  const blob = healthChecklist(HEALTH, { isValid: true, checkCompleted: true })
    .map((item) => item.label)
    .join(' ')
    .toLowerCase()
  for (const word of ['abeai', 'abe ai', 'mixpost', 'zernio', 'oauth', 'corpus']) {
    assert.ok(!blob.includes(word), `leaked "${word}"`)
  }
})
