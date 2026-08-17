import assert from 'node:assert/strict'
import test from 'node:test'
import { ideasFromPlan } from './ideas-from-plan.ts'

test('pillars with no matching post become what to write next', () => {
  const ideas = ideasFromPlan({
    pillars: ['Telehealth appointments', 'What a consult involves', 'Medicines education'],
    existingTitles: ['What a weight loss consultation actually involves'],
  })
  assert.equal(ideas.length, 2)
  assert.equal(ideas[0].title, 'Telehealth appointments')
  assert.equal(ideas[0].source, 'pillar')
})

test('a pillar already covered is not suggested again', () => {
  const ideas = ideasFromPlan({
    pillars: ['Meet the team'],
    existingTitles: ['Meet the team at Downscale'],
  })
  assert.equal(ideas.length, 0)
})

test('no pillars means an empty list, never invented topics', () => {
  assert.deepEqual(ideasFromPlan({ pillars: [], existingTitles: ['Anything'] }), [])
})
