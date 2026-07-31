/**
 * Re-push existing NRS drafts to Mixpost so they pick up fixes to the sync.
 *
 * Drafts created before per-platform options were sent carry Mixpost's wrong
 * defaults — a vertical video published as a pillarboxed feed post instead of a
 * Reel, and a YouTube post with an empty title. Those are baked into the
 * Mixpost post, so re-syncing is the only way to correct them.
 *
 * The caption is NOT rewritten. NRS is the source of truth for copy; this only
 * rebuilds the Mixpost side from it.
 *
 * The old Mixpost post is deleted first so the review queue doesn't end up with
 * a correct copy sitting next to a broken one.
 *
 * Usage:
 *   npx tsx scripts/resync-drafts-to-mixpost.ts <brandId> [--since=ISO] [--dry]
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { syncDraftToMixpost } from '@/lib/mixpost/sync-draft'
import { deleteMixpostPost } from '@/lib/mixpost/client'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const match = line.match(/^\s*(?:export\s+)?([A-Z_0-9]+)\s*=\s*(.*)$/)
  if (!match || process.env[match[1]]) continue
  process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const brandId = process.argv[2]
  const since = process.argv.find((a) => a.startsWith('--since='))?.split('=')[1]
  const dryRun = process.argv.includes('--dry')

  if (!brandId) {
    console.error('Usage: npx tsx scripts/resync-drafts-to-mixpost.ts <brandId> [--since=ISO] [--dry]')
    process.exit(1)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  let query = admin
    .from('scheduled_posts')
    .select('id, platform, post_type, caption, metadata, created_at')
    .eq('brand_id', brandId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })

  if (since) query = query.gte('created_at', since)

  const { data: drafts, error } = await query
  if (error) throw new Error(error.message)
  if (!drafts?.length) {
    console.log('No drafts to re-sync.')
    return
  }

  console.log(`${drafts.length} draft(s) to re-sync for brand ${brandId}\n`)

  for (const draft of drafts) {
    const mixpost = (draft.metadata as Record<string, unknown> | null)?.mixpost as
      | { post_uuid?: string }
      | undefined
    const label = `${draft.platform.padEnd(10)} ${draft.post_type ?? '?'} ${draft.id.slice(0, 8)}`

    if (dryRun) {
      console.log(`${label}  would re-sync (current mixpost: ${mixpost?.post_uuid ?? 'none'})`)
      continue
    }

    // Remove the stale Mixpost post so the fixed one replaces it.
    if (mixpost?.post_uuid) {
      try {
        await deleteMixpostPost(mixpost.post_uuid)
      } catch (err) {
        console.warn(`${label}  could not delete old Mixpost post: ${err}`)
      }
    }

    // Clear the sync marker — syncDraftToMixpost is idempotent and would
    // otherwise short-circuit on the post it already knows about.
    const metadata = { ...((draft.metadata as Record<string, unknown> | null) ?? {}) }
    delete metadata.mixpost
    await admin.from('scheduled_posts').update({ metadata }).eq('id', draft.id)

    const result = await syncDraftToMixpost(admin, draft.id)
    console.log(
      result.ok
        ? `${label}  OK   -> ${result.mixpost_post_uuid}`
        : `${label}  FAIL -> ${result.error}`,
    )
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
