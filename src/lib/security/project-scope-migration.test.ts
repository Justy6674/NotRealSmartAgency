import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/039_project_scope_security.sql')

test('project-scope migration establishes grants, links, connectors, channel state and quarantined memory', () => {
  const migration = readFileSync(migrationPath, 'utf8')

  for (const requiredTable of [
    'project_access_grants',
    'api_key_project_grants',
    'project_links',
    'project_connectors',
    'telegram_accounts',
    'telegram_pair_codes',
    'telegram_project_sessions',
    'execution_audit',
  ]) {
    assert.match(migration, new RegExp(`create table if not exists ${requiredTable}`, 'i'))
  }

  assert.match(migration, /add column if not exists brand_id uuid/i)
  assert.match(migration, /isolation_status text not null default 'active'/i)
  assert.match(migration, /update agent_memories[\s\S]*isolation_status = 'quarantined'/i)
  assert.match(migration, /update api_keys[\s\S]*revoked_at = now\(\)/i)
  assert.match(migration, /alter table oauth_auth_codes[\s\S]*project_ids uuid\[\]/i)
  assert.match(migration, /alter table mcp_jobs[\s\S]*channel text not null default 'mcp'/i)
})
