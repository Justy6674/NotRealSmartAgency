import assert from 'node:assert/strict'
import test from 'node:test'
import { buildGoalDirective, type ActiveGoal } from './goal-loop.ts'

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
