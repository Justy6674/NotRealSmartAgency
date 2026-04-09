/**
 * Read the latest upload debug trace for the user.
 *
 * Usage:
 *   node scripts/read-upload-trace.mjs             — show last 50 events across all traces
 *   node scripts/read-upload-trace.mjs <trace_id>  — show all events for a specific trace
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

const traceIdArg = process.argv[2]

let query = admin
  .from('audit_log')
  .select('entity_id, detail, created_at')
  .eq('action', 'upload_debug')
  .eq('entity_type', 'media_upload_trace')
  .order('created_at', { ascending: true })
  .limit(100)

if (traceIdArg) {
  query = query.eq('entity_id', traceIdArg)
}

const { data, error } = await query

if (error) {
  console.error('❌', error.message)
  process.exit(1)
}

if (!data?.length) {
  console.log(`No upload traces found${traceIdArg ? ` for ${traceIdArg}` : ''}.`)
  process.exit(0)
}

// Group by trace_id
const byTrace = new Map()
for (const row of data) {
  if (!byTrace.has(row.entity_id)) byTrace.set(row.entity_id, [])
  byTrace.get(row.entity_id).push(row)
}

for (const [traceId, events] of byTrace) {
  console.log(`\n━━━ TRACE ${traceId} (${events.length} events) ━━━`)
  const firstTs = new Date(events[0].created_at).getTime()
  for (const ev of events) {
    const d = ev.detail ?? {}
    const ms = new Date(ev.created_at).getTime() - firstTs
    const msPad = String(ms).padStart(6, ' ')
    const step = d.step ?? '?'
    const data = d.data && Object.keys(d.data).length ? JSON.stringify(d.data) : ''
    console.log(`  +${msPad}ms  ${step}  ${data}`)
  }
  const last = events[events.length - 1]
  const now = Date.now() - new Date(last.created_at).getTime()
  console.log(`  └ last event ${(now / 1000).toFixed(0)}s ago — build_sha=${last.detail?.build_sha ?? '?'}`)
}
