/**
 * One-shot backfill — push every media_items row that isn't in Mixpost yet.
 *
 * Reads .env.local for Supabase + Mixpost creds, walks all media_items
 * across all brands (or a specific brand if --brand-id passed), and calls
 * ensureMediaInMixpost for each row that doesn't already have
 * mixpost_media_id set.
 *
 * Idempotent: items already cached are skipped instantly.
 *
 * Videos take ~6 minutes each on the first pass (Mixpost ffmpeg transcode),
 * so a library with 20 videos can take ~2 hours. Images are ~5 seconds each.
 *
 * Usage:
 *   npx tsx scripts/backfill-media-to-mixpost.ts                    # all brands
 *   npx tsx scripts/backfill-media-to-mixpost.ts <brand_id>         # one brand
 *   npx tsx scripts/backfill-media-to-mixpost.ts --videos-only      # skip images
 *   npx tsx scripts/backfill-media-to-mixpost.ts <brand_id> --images-only
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { ensureMediaInMixpost } from '@/lib/mixpost/sync-draft'

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
  const videosOnly = args.includes('--videos-only')
  const imagesOnly = args.includes('--images-only')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  console.log(`\n━━━ MIXPOST BACKFILL ━━━`)
  console.log(`brand_id filter: ${brandIdArg ?? '(all brands)'}`)
  console.log(`mode: ${videosOnly ? 'videos only' : imagesOnly ? 'images only' : 'all media'}`)

  // Fetch media items that don't have a Mixpost id yet
  let query = admin
    .from('media_items')
    .select('id, brand_id, file_name, file_type, file_size_bytes, mixpost_media_id, brands(name)')
    .is('mixpost_media_id', null)
    .order('created_at', { ascending: false })

  if (brandIdArg) query = query.eq('brand_id', brandIdArg)

  if (videosOnly) query = query.like('file_type', 'video/%')
  if (imagesOnly) query = query.like('file_type', 'image/%')

  const { data: items, error } = await query

  if (error) {
    console.error(`❌ Query failed: ${error.message}`)
    process.exit(1)
  }

  if (!items?.length) {
    console.log(`\n✓ Nothing to backfill — every media item already has mixpost_media_id set.`)
    process.exit(0)
  }

  console.log(`\nFound ${items.length} item${items.length === 1 ? '' : 's'} to backfill:`)
  for (const item of items) {
    const brand = (item as { brands?: { name?: string } | { name?: string }[] }).brands
    const brandName = Array.isArray(brand) ? brand[0]?.name ?? '?' : brand?.name ?? '?'
    const sizeMb = item.file_size_bytes ? `${(item.file_size_bytes / 1024 / 1024).toFixed(1)}MB` : '?'
    console.log(`  - [${brandName}] ${item.file_name} (${item.file_type}, ${sizeMb})`)
  }

  console.log(`\nStarting in 3s. Press Ctrl+C to abort.`)
  await new Promise((r) => setTimeout(r, 3000))

  let success = 0
  let failed = 0
  const failures: Array<{ id: string; name: string; error: string }> = []
  const overallStart = Date.now()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const sizeMb = item.file_size_bytes ? `${(item.file_size_bytes / 1024 / 1024).toFixed(1)}MB` : '?'
    console.log(`\n[${i + 1}/${items.length}] ${item.file_name} (${item.file_type}, ${sizeMb})`)

    const start = Date.now()
    const result = await ensureMediaInMixpost(admin, item.id)
    const duration = ((Date.now() - start) / 1000).toFixed(1)

    if (result.id) {
      success++
      console.log(`  ✓ uploaded in ${duration}s — mixpost_id=${result.id}`)
    } else {
      failed++
      failures.push({ id: item.id, name: item.file_name ?? '?', error: result.error ?? 'unknown' })
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
      console.log(`  - ${f.name} (${f.id}): ${f.error}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
