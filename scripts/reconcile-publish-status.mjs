/**
 * Reconcile scheduled_posts against what the publisher actually did.
 *
 * NRS assumed a webhook would confirm publication and marked anything
 * unconfirmed as failed after ten minutes. The webhook was never registered, so
 * posts that published perfectly were recorded as failures. The cron publisher
 * now asks Mixpost directly; this repairs the history that was already written.
 *
 * Usage: node scripts/reconcile-publish-status.mjs [--apply]
 */
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const env = {}
for (const l of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const a = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { MIXPOST_API_URL: MP, MIXPOST_API_TOKEN: TOK, MIXPOST_WORKSPACE_UUID: WS } = env

const state = (s) => (s === 'published' || s === 2 ? 'published' : s === 'failed' || s === 3 ? 'failed' : null)

const { data: rows } = await a.from('scheduled_posts')
  .select('id, external_post_id, scheduled_at, error')
  .eq('status', 'failed').not('external_post_id', 'is', null)

console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — ${rows.length} failed posts that reached the publisher\n`)
let corrected = 0, genuine = 0, skipped = 0

for (const p of rows) {
  const id = p.external_post_id
  if (!/^[0-9a-f-]{36}$/i.test(id)) { console.log(`  ${id} — legacy id, cannot verify, left alone`); skipped++; continue }

  const r = await fetch(`${MP}/api/${WS}/posts/${id}`, { headers: { Authorization: `Bearer ${TOK}`, Accept: 'application/json' } })
  if (!r.ok) { console.log(`  ${id.slice(0, 13)}… HTTP ${r.status}, left alone`); skipped++; continue }

  const d = await r.json()
  const s = state((d.data ?? d).status)

  if (s === 'published') {
    if (APPLY) {
      await a.from('scheduled_posts')
        .update({ status: 'published', published_at: (d.data ?? d).published_at ?? new Date().toISOString(), error: null })
        .eq('id', p.id)
    }
    console.log(`  ${id.slice(0, 13)}…  live on the platform → published`)
    corrected++
  } else if (s === 'failed') {
    console.log(`  ${id.slice(0, 13)}…  genuinely failed at the publisher, unchanged`)
    genuine++
  } else {
    console.log(`  ${id.slice(0, 13)}…  status unclear, left alone`)
    skipped++
  }
}

console.log(`\ncorrected: ${corrected}   genuinely failed: ${genuine}   left alone: ${skipped}`)
if (!APPLY) console.log('Nothing was changed. Re-run with --apply.')
