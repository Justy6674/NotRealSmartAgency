import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildGoalDirective,
  buildGoalReviewBrief,
  validateGoalProgressUpdate,
} from './goal-loop.ts'

const activeGoal = {
  id: 'goal-1',
  title: 'Increase qualified trial bookings',
  description: 'Grow qualified bookings from the current marketing funnel.',
  success_criteria: {
    metric: 'Qualified trial bookings',
    target: '120 per month',
    baseline: '45 per month',
  },
  progress: {
    percent: 25,
    summary: 'Booking conversion page is live and the first campaign is in review.',
    evidence: ['Analytics report 2026-07-25'],
  },
  deadline: '2026-10-23T00:00:00.000Z',
  next_review_at: '2026-07-26T00:00:00.000Z',
}

test('an active goal gives every agent a concrete outcome and success test', () => {
  const directive = buildGoalDirective(activeGoal, 'TeleScribe')

  assert.match(directive, /ACTIVE END-USER OUTCOME/i)
  assert.match(directive, /Increase qualified trial bookings/)
  assert.match(directive, /Qualified trial bookings/)
  assert.match(directive, /120 per month/)
  assert.match(directive, /advance this outcome/i)
})

test('a missing goal makes the Director discover an outcome before starting autonomous work', () => {
  const directive = buildGoalDirective(null, 'TeleScribe')

  assert.match(directive, /NO ACTIVE END-USER OUTCOME/i)
  assert.match(directive, /one concise question/i)
  assert.match(directive, /do not invent a goal/i)
  assert.match(directive, /do not create or delegate ongoing work/i)
})

test('a scheduled goal review requires evidence, a recorded update, and one next action', () => {
  const brief = buildGoalReviewBrief(activeGoal)

  assert.match(brief, /record a progress update/i)
  assert.match(brief, /evidence/i)
  assert.match(brief, /exactly one next goal-linked task/i)
  assert.match(brief, /must not publish/i)
})

test('goal completion is rejected without evidence and full progress', () => {
  assert.equal(validateGoalProgressUpdate({
    percent: 100,
    summary: 'Done',
    evidence: [],
    status: 'completed',
  }), 'A completed goal requires at least one evidence item.')

  assert.equal(validateGoalProgressUpdate({
    percent: 80,
    summary: 'Mostly done',
    evidence: ['report'],
    status: 'completed',
  }), 'A completed goal must have 100% recorded progress.')

  assert.equal(validateGoalProgressUpdate({
    percent: 40,
    summary: 'Campaign is in review',
    evidence: ['draft queue'],
    status: 'active',
  }), null)
})
