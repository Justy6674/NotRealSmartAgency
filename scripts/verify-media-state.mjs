/**
 * Verify current state of a media_items row — full transcription, metadata, all fields.
 * Usage: node scripts/verify-media-state.mjs <media_item_id>
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

const id = process.argv[2] ?? '4c342177-c32c-4710-b285-867b425e7ea0'

const { data, error } = await admin
  .from('media_items')
  .select('*')
  .eq('id', id)
  .single()

if (error) {
  console.error('❌', error.message)
  process.exit(1)
}

console.log(`━━━ media_items ${id} ━━━`)
for (const [k, v] of Object.entries(data)) {
  if (k === 'transcription' && typeof v === 'string') {
    console.log(`  ${k}: "${v.slice(0, 200)}${v.length > 200 ? '...' : ''}" (${v.length} chars)`)
  } else if (typeof v === 'object') {
    console.log(`  ${k}: ${JSON.stringify(v)}`)
  } else {
    console.log(`  ${k}: ${v}`)
  }
}

// Check scheduled_posts for this media item
console.log(`\n━━━ scheduled_posts for this media ━━━`)
const { data: posts } = await admin
  .from('scheduled_posts')
  .select('id, platform, status, scheduled_at, caption')
  .eq('media_item_id', id)
console.log(`count: ${posts?.length ?? 0}`)
for (const p of posts ?? []) {
  console.log(`  [${p.platform}] ${p.status} — ${p.caption?.slice(0, 80)}...`)
}
