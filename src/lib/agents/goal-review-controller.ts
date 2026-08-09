import { validateGoalReviewFollowUp } from './goal-loop'

export type GoalReviewOwnerReviewCode =
  | 'goal_review_worker_failed'
  | 'goal_review_progress_missing'
  | 'goal_review_next_action_missing'

export type GoalReviewOutcome =
  | { kind: 'completed' }
  | { kind: 'needs_owner_review'; code: GoalReviewOwnerReviewCode }

export interface GoalReviewOutcomeInput {
  workerError: string | null
  /** A successful state write, never merely an attempted tool call. */
  progressRecorded: boolean
  goalStatus: string | null
  followUpTaskCount: number
  reviewApprovalCount: number
}

/**
 * Decides the durable outcome of a scheduled goal review. The worker is free
 * to investigate, but it cannot make the scheduler retry forever by omitting
 * a tool call. Any incomplete review becomes a visible owner-review task.
 */
export function resolveGoalReviewOutcome(input: GoalReviewOutcomeInput): GoalReviewOutcome {
  if (input.workerError) {
    return { kind: 'needs_owner_review', code: 'goal_review_worker_failed' }
  }

  if (!input.progressRecorded) {
    return { kind: 'needs_owner_review', code: 'goal_review_progress_missing' }
  }

  if (validateGoalReviewFollowUp(
    input.goalStatus,
    input.followUpTaskCount,
    input.reviewApprovalCount,
  )) {
    return { kind: 'needs_owner_review', code: 'goal_review_next_action_missing' }
  }

  return { kind: 'completed' }
}

export function describeGoalReviewOwnerReview(code: GoalReviewOwnerReviewCode): string {
  switch (code) {
    case 'goal_review_worker_failed':
      return 'NRS could not complete this goal review safely. Nothing was published or changed externally. Open the Director to decide the next step.'
    case 'goal_review_progress_missing':
      return 'NRS reviewed this goal but could not record verified progress safely. Nothing was published or changed externally. Open the Director to decide the next step.'
    case 'goal_review_next_action_missing':
      return 'NRS recorded progress but could not identify one safe next action. Nothing was published or changed externally. Open the Director to decide the next step.'
  }
}
