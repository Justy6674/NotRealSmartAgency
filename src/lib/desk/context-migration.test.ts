import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260811020000_nrs_desk_context.sql'), 'utf8')

test('the Desk migration is additive and gives conversations durable context', () => {
  assert.match(migration, /alter table public\.conversations[\s\S]*add column if not exists metadata jsonb not null default '\{\}'::jsonb/)
  assert.match(migration, /alter table public\.messages[\s\S]*add column if not exists client_turn_id uuid/)
  assert.match(migration, /unique index if not exists idx_messages_conversation_client_turn_role/)
})
