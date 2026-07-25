import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/041_goal_director_loop.sql')

test('goal-loop migration creates one active scoped objective and a due-review claim path', () => {
  const migration = readFileSync(migrationPath, 'utf8')

  assert.match(migration, /add column if not exists success_criteria jsonb/i)
  assert.match(migration, /add column if not exists progress jsonb/i)
  assert.match(migration, /add column if not exists next_review_at timestamptz/i)
  assert.match(migration, /add column if not exists review_claim_expires_at timestamptz/i)
  assert.match(migration, /create unique index if not exists idx_goals_one_active_objective_per_brand/i)
  assert.match(migration, /where level = 'objective' and status = 'active' and brand_id is not null/i)
  assert.match(migration, /create trigger schedule_active_goal_review/i)
  assert.match(migration, /idx_tasks_goal_open/i)
})
