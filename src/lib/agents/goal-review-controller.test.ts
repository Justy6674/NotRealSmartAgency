import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveGoalReviewOutcome } from './goal-review-controller.ts'

test('a goal review that recorded evidence and one safe next action completes', () => {
  assert.deepEqual(resolveGoalReviewOutcome({
    workerError: null,
    progressRecorded: true,
    goalStatus: 'active',
    followUpTaskCount: 1,
    reviewApprovalCount: 0,
  }), { kind: 'completed' })
})

test('a goal review that skips the progress write stops for the owner instead of retrying', () => {
  assert.deepEqual(resolveGoalReviewOutcome({
    workerError: null,
    progressRecorded: false,
    goalStatus: 'active',
    followUpTaskCount: 0,
    reviewApprovalCount: 0,
  }), {
    kind: 'needs_owner_review',
    code: 'goal_review_progress_missing',
  })
})

test('a goal review that leaves an active goal without one next action stops for the owner', () => {
  assert.deepEqual(resolveGoalReviewOutcome({
    workerError: null,
    progressRecorded: true,
    goalStatus: 'active',
    followUpTaskCount: 0,
    reviewApprovalCount: 0,
  }), {
    kind: 'needs_owner_review',
    code: 'goal_review_next_action_missing',
  })
})

test('a worker failure is surfaced for review instead of creating an automatic retry loop', () => {
  assert.deepEqual(resolveGoalReviewOutcome({
    workerError: 'AI Gateway timed out',
    progressRecorded: false,
    goalStatus: null,
    followUpTaskCount: 0,
    reviewApprovalCount: 0,
  }), {
    kind: 'needs_owner_review',
    code: 'goal_review_worker_failed',
  })
})
