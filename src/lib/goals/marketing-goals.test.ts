import assert from 'node:assert/strict'
import test from 'node:test'
import {
  GOAL_REVIEW_DAYS,
  attentionAction,
  describeTarget,
  goalAttention,
  goalProgress,
  readGoalRow,
  summariseGoal,
  targetProgress,
  type MarketingGoal,
  type SocialTarget,
} from './marketing-goals.ts'

const NOW = new Date('2026-07-30T09:00:00.000Z')

function ago(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function target(over: Partial<SocialTarget> = {}): SocialTarget {
  return { platform: 'instagram', metric: 'followers', current: 0, target: 100, ...over }
}

function goal(over: Partial<MarketingGoal> = {}): MarketingGoal {
  return {
    id: 'g1',
    brandId: 'p1',
    title: 'Fill the telehealth calendar',
    description: null,
    status: 'active',
    targets: [],
    deadline: null,
    lastReviewedAt: ago(1),
    nextReviewAt: null,
    createdAt: ago(1),
    supersedes: null,
    ...over,
  }
}

test('an unmeasured target reports not-measured, never zero progress', () => {
  // Zero says "no progress", which is a claim. Null says "not measured",
  // which is the truth — and the two lead to different decisions.
  assert.equal(targetProgress(target({ current: null })), null)
  assert.equal(targetProgress(target({ current: 0 })), 0)
})

test('progress is a fraction of the target, capped at complete', () => {
  assert.equal(targetProgress(target({ current: 50, target: 100 })), 0.5)
  assert.equal(targetProgress(target({ current: 250, target: 100 })), 1)
})

test('a target of zero cannot produce a progress figure', () => {
  assert.equal(targetProgress(target({ current: 10, target: 0 })), null)
})

test('unmeasured targets are excluded rather than counted as zero', () => {
  // Otherwise one measured target at 80% reads as 20% because three others
  // have never been counted.
  const progress = goalProgress({
    targets: [
      target({ current: 80, target: 100 }),
      target({ current: null }),
      target({ current: null }),
      target({ current: null }),
    ],
  })
  assert.equal(progress.percent, 80)
  assert.equal(progress.measured, 1)
  assert.equal(progress.total, 4)
})

test('a goal with nothing measured has no percentage at all', () => {
  const progress = goalProgress({ targets: [target({ current: null })] })
  assert.equal(progress.percent, null)
})

test('a project with no goal is the loudest thing', () => {
  assert.deepEqual(goalAttention(null, NOW), { kind: 'not_set' })
})

test('a goal whose targets have never been measured is raised', () => {
  const attention = goalAttention(goal({ targets: [target({ current: null })] }), NOW)
  assert.equal(attention.kind, 'never_measured')
})

test('a passed deadline is raised with how long ago', () => {
  const attention = goalAttention(
    goal({ targets: [target({ current: 10 })], deadline: ago(5) }),
    NOW,
  )
  assert.equal(attention.kind, 'deadline_passed')
  assert.equal(attention.kind === 'deadline_passed' && attention.daysPast, 5)
})

test('a goal not looked at in over a month is due for review', () => {
  const attention = goalAttention(
    goal({ targets: [target({ current: 10 })], lastReviewedAt: ago(GOAL_REVIEW_DAYS + 4) }),
    NOW,
  )
  assert.equal(attention.kind, 'due_for_review')
  assert.equal(attention.kind === 'due_for_review' && attention.daysOverdue, 4)
})

test('a goal never reviewed falls back to when it was set', () => {
  // Otherwise a goal set a year ago and never reviewed reads as current.
  const attention = goalAttention(
    goal({ targets: [target({ current: 10 })], lastReviewedAt: null, createdAt: ago(90) }),
    NOW,
  )
  assert.equal(attention.kind, 'due_for_review')
})

test('a healthy, measured, recently reviewed goal needs nothing', () => {
  const attention = goalAttention(goal({ targets: [target({ current: 10 })] }), NOW)
  assert.equal(attention.kind, 'none')
})

test('every kind of attention produces something to hand the Director', () => {
  const kinds = [
    goalAttention(null, NOW),
    goalAttention(goal({ targets: [target({ current: null })] }), NOW),
    goalAttention(goal({ targets: [target({ current: 1 })], deadline: ago(3) }), NOW),
    goalAttention(goal({ targets: [target({ current: 1 })], lastReviewedAt: ago(99) }), NOW),
  ]
  for (const attention of kinds) {
    const action = attentionAction(attention, 'Downscale', goal())
    assert.ok(action && action.length > 25, `${attention.kind} has no usable action`)
    assert.match(action!, /Downscale/)
  }
  assert.equal(attentionAction({ kind: 'none' }, 'Downscale', goal()), null)
})

test('the tile line says where things stand without jargon', () => {
  assert.equal(summariseGoal(null), 'No goal set')
  assert.match(summariseGoal(goal({ targets: [target({ current: null })] })), /not measured yet/)
  assert.match(summariseGoal(goal({ targets: [target({ current: 50, target: 100 })] })), /50% there/)
})

test('a target reads as a sentence a person would say', () => {
  assert.match(
    describeTarget(target({ platform: 'instagram', metric: 'followers', current: 850, target: 2000 })),
    /Instagram: 850 of 2000 followers/,
  )
  assert.match(describeTarget(target({ current: null })), /not measured yet/)
})

test('a malformed stored target is dropped rather than shown', () => {
  // A half-read target renders as a confident number that is not real.
  const read = readGoalRow({
    id: 'g1',
    brand_id: 'p1',
    title: 'Grow',
    description: null,
    status: 'active',
    success_criteria: {
      social_targets: [
        { platform: 'instagram', metric: 'followers', target: 2000, current: 850 },
        { platform: 'myspace', metric: 'followers', target: 10 },
        { platform: 'instagram', metric: 'vibes', target: 10 },
        { platform: 'instagram', metric: 'followers', target: 'lots' },
        { platform: 'linkedin', metric: 'posts_per_week', target: 3 },
      ],
    },
    deadline: null,
    last_reviewed_at: null,
    next_review_at: null,
    created_at: ago(1),
    parent_id: null,
  })

  assert.equal(read.targets.length, 2)
  assert.deepEqual(read.targets.map((t) => t.platform), ['instagram', 'linkedin'])
  assert.equal(read.targets[1].current, null, 'an absent current must not become zero')
})

test('a goal with no stored targets reads as having none, not as broken', () => {
  const read = readGoalRow({
    id: 'g1', brand_id: 'p1', title: 'Grow', description: null, status: 'active',
    success_criteria: null, deadline: null, last_reviewed_at: null, next_review_at: null,
    created_at: ago(1), parent_id: null,
  })
  assert.deepEqual(read.targets, [])
})

test('the goal it replaced is remembered', () => {
  // Setting a goal used to overwrite the previous one, destroying the history
  // that shows whether a target was ever met.
  const read = readGoalRow({
    id: 'g2', brand_id: 'p1', title: 'Grow again', description: null, status: 'active',
    success_criteria: null, deadline: null, last_reviewed_at: null, next_review_at: null,
    created_at: ago(1), parent_id: 'g1',
  })
  assert.equal(read.supersedes, 'g1')
})
