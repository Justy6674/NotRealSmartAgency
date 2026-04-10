/**
 * One-shot backfill — push every scheduled_posts draft that isn't in
 * Mixpost yet through syncDraftToMixpost.
 *
 * Context: syncDraftToMixpost shipped 2026-04-10 at 01:29 UTC. Any draft
 * created before that has no metadata.mixpost.post_uuid and so the Review
 * pane's "Preview in Mixpost" button / pill stays disabled forever. This
 * script catches them up.
 *
 * Reuses the already-idempotent syncDraftToMixpost helper — safe to run
 * multiple times, it no-ops anything already synced. Also triggers media
 * backfill as a side-effect for any referenced media_items that haven't
 * been pushed to Mixpost yet.
 *
 * Duration: drafts with cached media or images are ~5s each. Drafts with
 * uncached videos trigger a ~6 minute ffmpeg transcode (one-time per
 * video, then cached on media_items.mixpost_media_id).
 *
 * Usage:
 *   npx tsx scripts/backfill-drafts-to-mixpost.ts                 # all brands
 *   npx tsx scripts/backfill-drafts-to-mixpost.ts <brand_id>      # one brand
 *   npx tsx scripts/backfill-drafts-to-mixpost.ts --dry-run       # show plan only
 *   npx tsx scripts/backfill-drafts-to-mixpost.ts <brand_id> --dry-run
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { syncDraftToMixpost } from '@/lib/mixpost/sync-draft'

async function main() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const envPath = resolve(__dirname, '..', '.env.local')
  const envContent = readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/)
    if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }

  // Parse args
  const args = process.argv.slice(2)
  const brandIdArg = args.find((a) => !a.startsWith('--'))
  const dryRun = args.includes('--dry-run')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  console.log(`\n━━━ MIXPOST DRAFT BACKFILL ━━━`)
  console.log(`brand_id filter: ${brandIdArg ?? '(all brands)'}`)
  console.log(`mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)

  // Fetch drafts / scheduled posts that don't have a Mixpost sync yet.
  // metadata->'mixpost'->>'post_uuid' is null covers both shapes:
  //   - posts predating the feature (no metadata.mixpost at all)
  //   - posts where the sync failed previously (no post_uuid inside)
  let query = admin
    .from('scheduled_posts')
    .select('id, brand_id, platform, caption, created_at, status, media_item_ids, metadata, brands(name)')
    .in('status', ['draft', 'scheduled'])
    .is('metadata->mixpost->>post_uuid', null)
    .order('created_at', { ascending: false })

  if (brandIdArg) query = query.eq('brand_id', brandIdArg)

  const { data: posts, error } = await query

  if (error) {
    console.error(`❌ Query failed: ${error.message}`)
    process.exit(1)
  }

  if (!posts?.length) {
    console.log(`\n✓ Nothing to backfill — every draft already has metadata.mixpost set.`)
    process.exit(0)
  }

  console.log(`\nFound ${posts.length} draft${posts.length === 1 ? '' : 's'} to backfill:`)
  for (const post of posts) {
    const brand = (post as { brands?: { name?: string } | { name?: string }[] }).brands
    const brandName = Array.isArray(brand) ? brand[0]?.name ?? '?' : brand?.name ?? '?'
    const mediaCount = (post.media_item_ids as string[] | null)?.length ?? 0
    const captionSnippet = (post.caption ?? '').slice(0, 60).replace(/\n/g, ' ')
    const createdAt = new Date(post.created_at).toISOString().slice(0, 16).replace('T', ' ')
    console.log(
      `  - [${brandName}] ${post.platform.padEnd(9)} ${createdAt}  media:${mediaCount}  "${captionSnippet}${captionSnippet.length === 60 ? '…' : ''}"`,
    )
  }

  if (dryRun) {
    console.log(`\n━━━ DRY RUN ━━━`)
    console.log(`No writes. Re-run without --dry-run to push these drafts to Mixpost.`)
    process.exit(0)
  }

  console.log(`\nStarting in 3s. Press Ctrl+C to abort.`)
  await new Promise((r) => setTimeout(r, 3000))

  let success = 0
  let failed = 0
  const failures: Array<{ id: string; platform: string; error: string }> = []
  const overallStart = Date.now()

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]
    const mediaCount = (post.media_item_ids as string[] | null)?.length ?? 0
    console.log(`\n[${i + 1}/${posts.length}] ${post.platform} · media:${mediaCount} · ${post.id}`)

    const start = Date.now()
    const result = await syncDraftToMixpost(admin, post.id)
    const duration = ((Date.now() - start) / 1000).toFixed(1)

    if (result.ok) {
      success++
      console.log(`  ✓ synced in ${duration}s — mixpost_uuid=${result.mixpost_post_uuid}`)
      if (result.media_results?.length) {
        for (const m of result.media_results) {
          if (m.error) console.log(`    ⚠ media ${m.media_item_id}: ${m.error}`)
        }
      }
    } else {
      failed++
      failures.push({ id: post.id, platform: post.platform, error: result.error ?? 'unknown' })
      console.log(`  ✗ failed after ${duration}s — ${result.error ?? 'unknown'}`)
    }
  }

  const totalDuration = ((Date.now() - overallStart) / 1000 / 60).toFixed(1)
  console.log(`\n━━━ COMPLETE ━━━`)
  console.log(`Success: ${success}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total time: ${totalDuration} min`)

  if (failures.length) {
    console.log(`\nFailures:`)
    for (const f of failures) {
      console.log(`  - ${f.platform} (${f.id}): ${f.error}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
