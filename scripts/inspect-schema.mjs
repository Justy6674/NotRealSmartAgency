/**
 * Quick schema inspector — reads tables I care about for the current task.
 * Usage: node scripts/inspect-schema.mjs
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(import.meta.dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/)
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Inspect audit_log schema by grabbing one row
console.log('\n━━━ audit_log sample row ━━━')
const { data: auditSample } = await admin.from('audit_log').select('*').limit(1).single()
console.log(JSON.stringify(auditSample, null, 2))

// Inspect media_items that already have processing reports in metadata
console.log('\n━━━ Recent media_items for TeleScribe with metadata ━━━')
const { data: media } = await admin
  .from('media_items')
  .select('id, file_name, file_type, thumbnail_url, duration_seconds, tags, file_size_bytes, created_at, file_created_at, metadata, transcription_status')
  .eq('brand_id', 'a0ae3d52-c1e3-4212-8d18-ea4386439b34')
  .order('created_at', { ascending: false })
  .limit(5)

for (const m of media ?? []) {
  console.log(`\n  ${m.file_name}`)
  console.log(`    id: ${m.id}`)
  console.log(`    type: ${m.file_type}, size: ${m.file_size_bytes}, duration: ${m.duration_seconds}s`)
  console.log(`    thumb: ${m.thumbnail_url ?? '(none)'}`)
  console.log(`    tags: ${JSON.stringify(m.tags)}`)
  console.log(`    created: ${m.created_at}`)
  console.log(`    metadata: ${JSON.stringify(m.metadata)?.slice(0, 200)}`)
  console.log(`    transcription_status: ${m.transcription_status}`)
}

// Check scheduled_posts usage for media items
console.log('\n━━━ scheduled_posts usage sample ━━━')
const { data: usage } = await admin
  .from('scheduled_posts')
  .select('id, media_item_id, status, published_at, platforms, brand_id')
  .eq('brand_id', 'a0ae3d52-c1e3-4212-8d18-ea4386439b34')
  .not('media_item_id', 'is', null)
  .limit(5)
console.log(JSON.stringify(usage, null, 2))
