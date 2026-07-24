import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const migrationPath = resolve(process.cwd(), 'supabase/migrations/040_github_app_connectors.sql')

test('GitHub App connector migration stores only scoped installation metadata and hashed connect state', () => {
  const migration = readFileSync(migrationPath, 'utf8')

  for (const requiredTable of [
    'github_app_installations',
    'github_installation_repositories',
    'github_repository_bindings',
    'github_connect_requests',
  ]) {
    assert.match(migration, new RegExp(`create table if not exists ${requiredTable}`, 'i'))
  }

  assert.match(migration, /state_hash text not null unique/i)
  assert.doesNotMatch(migration, /\b(access_)?token\b/i)
  assert.match(migration, /read_only true/i)
  assert.match(migration, /allowed_paths <@ array\[/i)
  assert.match(migration, /enable row level security/i)
})
