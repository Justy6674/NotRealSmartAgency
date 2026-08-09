import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('heartbeat gives a goal review a narrow action space and sends incomplete work to the owner', () => {
  const route = readFileSync(resolve(process.cwd(), 'src/app/api/heartbeat/route.ts'), 'utf8')

  assert.match(route, /allowedToolNames:\s*GOAL_REVIEW_TOOL_NAMES/)
  assert.match(route, /requiredAllToolNames:\s*\['update_goal_progress'\]/)
  assert.match(route, /resolveGoalReviewOutcome/)
  assert.match(route, /moveGoalReviewToOwner/)
  assert.match(route, /status:\s*'review'/)
  assert.doesNotMatch(route, /Goal review did not record evidence-based progress/)
})

test('heartbeat only cancels the historical null-result retry-loop rows', () => {
  const route = readFileSync(resolve(process.cwd(), 'src/app/api/heartbeat/route.ts'), 'utf8')

  assert.match(route, /reconcileHistoricalGoalReviewLoop/)
  assert.match(route, /recoverHistoricalGoalReviewLoops\(supabase\)/)
  assert.match(route, /\.contains\('context', \{ kind: 'goal_review' \}\)/)
  assert.match(route, /\.is\('result', null\)/)
  assert.match(route, /\.eq\('status', 'blocked'\)/)
  assert.match(route, /status: 'cancelled'/)
})
