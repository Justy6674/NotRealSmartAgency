import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

test('heartbeat requires a persisted next action before completing an active goal review', () => {
  const route = readFileSync(resolve(process.cwd(), 'src/app/api/heartbeat/route.ts'), 'utf8')

  assert.match(route, /validateGoalReviewFollowUp/)
  assert.match(route, /taskId:\s*task\.id/)
  assert.match(route, /from\('approval_queue'\)/)
  assert.match(route, /\.eq\('task_id', task\.id\)/)
  assert.match(route, /\.neq\('id', task\.id\)/)
})
