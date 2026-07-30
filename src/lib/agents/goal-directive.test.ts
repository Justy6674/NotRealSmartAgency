import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGoalDirective, toActiveGoal, type ActiveGoal } from './goal-loop.ts'

function goal(over: Partial<ActiveGoal> = {}): ActiveGoal {
  return {
    id: 'g1',
    title: 'Fill the telehealth calendar',
    description: null,
    success_criteria: { outcome: 'More booked consults' },
    progress: { percent: 0, summary: 'Goal set.', evidence: [] },
    deadline: null,
    next_review_at: null,
    ...over,
  }
}

test("the owner's per-platform numbers reach the agent writing the post", () => {
  // A goal that says only "grow social" gives an agent writing an Instagram
  // post nothing to aim at. The numbers are the direction, and they are his.
  const directive = buildGoalDirective(
    goal({
      success_criteria: {
        outcome: 'More booked consults',
        social_targets: [
          { platform: 'instagram', metric: 'followers', current: 850, target: 2000 },
          { platform: 'linkedin', metric: 'posts_per_week', current: null, target: 3 },
        ],
      },
    }),
    'Downscale',
  )

  assert.match(directive, /Instagram: 850 now, aiming for 2000 followers/)
  assert.match(directive, /Linkedin: reach 3 posts a week — not measured yet/i)
  assert.match(directive, /write towards its number/i)
})

test('a goal with no social targets says nothing about channels', () => {
  assert.ok(!buildGoalDirective(goal(), 'Downscale').includes('What each channel is aiming at'))
})

test('a malformed stored target is dropped, not rendered as a number', () => {
  const directive = buildGoalDirective(
    goal({
      success_criteria: {
        outcome: 'x',
        social_targets: [
          { platform: 'instagram', metric: 'followers', target: 'heaps' },
          { metric: 'followers', target: 10 },
          { platform: 'facebook', metric: 'reach', target: 5000 },
        ],
      },
    }),
    'Downscale',
  )
  assert.ok(!directive.includes('heaps'))
  assert.match(directive, /Facebook: reach 5000 people reached/)
  assert.equal((directive.match(/^- /gm) ?? []).length, 1, 'only the valid target may render')
})

test('a project with no goal is still told to ask rather than invent one', () => {
  assert.match(buildGoalDirective(null, 'Downscale'), /Do not invent a goal/)
})

test('targets survive the trip from a stored row to the prompt', () => {
  // The previous test built the goal object by hand and so never exercised
  // toActiveGoal, which was silently dropping social_targets — the numbers
  // could not have reached an agent no matter what was stored.
  const active = toActiveGoal({
    id: 'g1',
    title: 'Get people swapping',
    description: null,
    success_criteria: {
      outcome: 'Get people swapping',
      social_targets: [{ platform: 'instagram', metric: 'posts_per_week', target: 4, current: 0 }],
    },
    progress: { percent: 0, summary: 'Set.', evidence: [] },
    deadline: null,
    next_review_at: null,
  })

  assert.ok(active, 'the row must map')
  const directive = buildGoalDirective(active!, 'Scent Sell')
  assert.match(directive, /Instagram: 0 now, aiming for 4 posts a week/)
})

test('a stored goal with no targets still maps cleanly', () => {
  const active = toActiveGoal({
    id: 'g1', title: 'x', description: null,
    success_criteria: { outcome: 'x' },
    progress: { percent: 0, summary: 'Set.', evidence: [] },
    deadline: null, next_review_at: null,
  })
  assert.ok(active)
  assert.equal(active!.success_criteria.social_targets, undefined)
})

test('a project with no goal sends the Director to the interview, not to a form', () => {
  // He asked for a director who asks questions. A model composing its own
  // nine-question list is the form again, and its answers die with the tab.
  const directive = buildGoalDirective(null, 'Scent Sell')
  assert.match(directive, /goal_interview tool/)
  assert.match(directive, /One question per turn/i)
  assert.match(directive, /form with extra steps/i)
})
