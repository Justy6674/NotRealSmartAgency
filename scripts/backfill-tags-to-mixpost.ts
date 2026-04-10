/**
 * One-shot backfill — create a Mixpost tag for every NRS brand + every
 * hashtag_group that doesn't already have one. Idempotent: subsequent
 * runs only touch rows where mixpost_tag_id is still null.
 *
 * After this runs, Mixpost's library/tag filter lets you pick any
 * NRS brand or hashtag group and see all drafts that belong to it.
 *
 * Usage:
 *   npx tsx scripts/backfill-tags-to-mixpost.ts              # brands + groups
 *   npx tsx scripts/backfill-tags-to-mixpost.ts --dry-run    # show plan only
 *   npx tsx scripts/backfill-tags-to-mixpost.ts --brands-only
 *   npx tsx scripts/backfill-tags-to-mixpost.ts --groups-only
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { ensureBrandTagInMixpost, ensureHashtagGroupTagInMixpost } from '@/lib/mixpost/sync-tags'

async function main() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const envPath = resolve(__dirname, '..', '.env.local')
  const envContent = readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.+)$/)
    if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }

  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const brandsOnly = args.includes('--brands-only')
  const groupsOnly = args.includes('--groups-only')

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  console.log(`\n━━━ MIXPOST TAG BACKFILL ━━━`)
  console.log(`mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`scope: ${brandsOnly ? 'brands only' : groupsOnly ? 'groups only' : 'brands + groups'}`)

  let brandSuccess = 0
  let brandFailed = 0
  let groupSuccess = 0
  let groupFailed = 0

  // ── Brands ─────────────────────────────────────────────────────────────
  if (!groupsOnly) {
    const { data: brands, error: bErr } = await admin
      .from('brands')
      .select('id, name, mixpost_tag_id')
      .is('mixpost_tag_id', null)
      .order('name')

    if (bErr) {
      console.error(`❌ Brand query failed: ${bErr.message}`)
      process.exit(1)
    }

    console.log(`\nBrands needing Mixpost tags: ${brands?.length ?? 0}`)
    for (const b of brands ?? []) console.log(`  - ${b.name}`)

    if (!dryRun) {
      for (const b of brands ?? []) {
        const r = await ensureBrandTagInMixpost(admin, b.id)
        if (r) {
          console.log(`  ✓ ${b.name} → mixpost_tag_id=${r.id}`)
          brandSuccess++
        } else {
          console.log(`  ✗ ${b.name} — tag creation failed`)
          brandFailed++
        }
      }
    }
  }

  // ── Hashtag groups ─────────────────────────────────────────────────────
  if (!brandsOnly) {
    const { data: groups, error: gErr } = await admin
      .from('hashtag_groups')
      .select('id, name, brand_id, mixpost_tag_id, brands(name)')
      .is('mixpost_tag_id', null)
      .order('name')

    if (gErr) {
      console.error(`❌ Hashtag group query failed: ${gErr.message}`)
      process.exit(1)
    }

    console.log(`\nHashtag groups needing Mixpost tags: ${groups?.length ?? 0}`)
    for (const g of groups ?? []) {
      const brand = (g as { brands?: { name?: string } | { name?: string }[] }).brands
      const brandName = Array.isArray(brand) ? brand[0]?.name ?? '?' : brand?.name ?? '?'
      console.log(`  - [${brandName}] ${g.name}`)
    }

    if (!dryRun) {
      for (const g of groups ?? []) {
        const r = await ensureHashtagGroupTagInMixpost(admin, g.id)
        if (r) {
          console.log(`  ✓ ${g.name} → mixpost_tag_id=${r.id}`)
          groupSuccess++
        } else {
          console.log(`  ✗ ${g.name} — tag creation failed`)
          groupFailed++
        }
      }
    }
  }

  console.log(`\n━━━ COMPLETE ━━━`)
  if (dryRun) {
    console.log(`Dry run — no writes. Re-run without --dry-run to create tags.`)
  } else {
    console.log(`Brands:          ${brandSuccess} created, ${brandFailed} failed`)
    console.log(`Hashtag groups:  ${groupSuccess} created, ${groupFailed} failed`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
