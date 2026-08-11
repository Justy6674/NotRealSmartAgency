import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260811010000_secure_media_brand_scope.sql'), 'utf8')

test('the desktop inbox migration makes its storage path unique and keeps media access brand-scoped', () => {
  assert.match(migration, /unique index if not exists idx_media_items_desktop_inbox_storage_path/)
  assert.match(migration, /metadata ->> 'source' = 'desktop_media_inbox'/)
  assert.match(migration, /create or replace function public\.can_write_media_for_brand/)
  assert.match(migration, /tm\.brand_ids is null or media_items\.brand_id = any\(tm\.brand_ids\)/)
  assert.match(migration, /using \(public\.can_write_media_for_brand\(user_id, brand_id\)\)/)
})
