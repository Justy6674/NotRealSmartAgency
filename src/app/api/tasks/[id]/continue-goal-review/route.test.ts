import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('continuing a goal review is authenticated, owner-gated, and schedules a fresh review without publishing', () => {
  const route = readFileSync(
    resolve(process.cwd(), 'src/app/api/tasks/[id]/continue-goal-review/route.ts'),
    'utf8',
  )

  assert.match(route, /supabase\.auth\.getUser\(\)/)
  assert.match(route, /task\.status !== 'review'/)
  assert.match(route, /asRecord\(task\.context\)\.kind !== 'goal_review'/)
  assert.match(route, /\.eq\('user_id', user\.id\)/)
  assert.match(route, /\.eq\('status', 'review'\)/)
  assert.match(route, /status: 'done'/)
  assert.match(route, /state: 'owner_continued'/)
  assert.match(route, /markGoalReadyForReview\(supabase, user\.id, task\.goal_id\)/)
  assert.match(route, /goal_review_owner_continued/)
  assert.doesNotMatch(route, /publish_to_social|syncDraftToMixpost|create_post/i)
})
