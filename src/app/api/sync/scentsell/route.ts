import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Sync Scent Sell product images → NRS Media Pantry
 *
 * Pulls from Scent Sell's Supabase directly:
 * 1. Marketplace listings → tagged "marketplace"
 * 2. Sample shop items → tagged "sample-shop"
 *
 * New items stored as Director memory alerts.
 * Deduplicates via metadata.scentsell_sync_key.
 */

const SCENTSELL_URL = 'https://dejjxzdgahtfzakkceby.supabase.co'
const SCENTSELL_ANON_KEY = process.env.SCENTSELL_ANON_KEY ?? ''

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  const nrs = createAdminClient()

  // Get Scent Sell brand in NRS
  const { data: brand } = await nrs
    .from('brands')
    .select('id, user_id')
    .ilike('name', '%scent%sell%')
    .single()

  if (!brand) {
    return NextResponse.json({ error: 'Scent Sell brand not found in NRS' }, { status: 404 })
  }

  if (!SCENTSELL_ANON_KEY) {
    return NextResponse.json({ error: 'SCENTSELL_ANON_KEY not configured. Add SCENTSELL_ANON_KEY to .env.local' }, { status: 500 })
  }

  const scentsell = createClient(SCENTSELL_URL, SCENTSELL_ANON_KEY)
  const results = { marketplace: 0, sampleShop: 0, skipped: 0, newItems: [] as string[] }

  // ── Get existing sync keys to avoid duplicates ─────────────────────────
  const { data: existingMedia } = await nrs
    .from('media_items')
    .select('metadata')
    .eq('brand_id', brand.id)
    .not('metadata', 'is', null)

  const existingSyncKeys = new Set(
    (existingMedia ?? [])
      .map(m => (m.metadata as Record<string, unknown>)?.scentsell_sync_key)
      .filter(Boolean)
  )

  // ── 1. Sync Marketplace Listings ────────────────────────────────────────

  const { data: listings } = await scentsell
    .from('listings')
    .select('id, brand, fragrance_name, size_ml, fill_percentage, condition, price_aud, status, photos:listing_photos(photo_url, display_order)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(200)

  if (listings?.length) {
    for (const listing of listings) {
      const photos = (listing as unknown as { photos?: { photo_url: string; display_order?: number }[] }).photos ?? []
      const frontPhoto = photos.sort((a: { display_order?: number }, b: { display_order?: number }) => (a.display_order ?? 0) - (b.display_order ?? 0))[0]
      if (!frontPhoto?.photo_url) continue

      const syncKey = `listing-${listing.id}`
      if (existingSyncKeys.has(syncKey)) { results.skipped++; continue }

      const price = (listing as { price_aud?: number }).price_aud ?? 0
      const name = `${(listing as { brand?: string }).brand} ${(listing as { fragrance_name?: string }).fragrance_name}`

      await nrs.from('media_items').insert({
        user_id: brand.user_id,
        brand_id: brand.id,
        file_url: frontPhoto.photo_url,
        file_name: `ScentSell-${name.replace(/[^a-zA-Z0-9]/g, '-')}`,
        file_type: 'image/jpeg',
        file_size_bytes: 0,
        tags: [
          'marketplace', 'fragrance', 'for-sale',
          ((listing as { brand?: string }).brand ?? '').toLowerCase(),
          ((listing as { fragrance_name?: string }).fragrance_name ?? '').toLowerCase(),
          `${(listing as { size_ml?: number }).size_ml ?? 0}ml`,
          ((listing as { condition?: string }).condition ?? '').toLowerCase(),
        ].filter(Boolean),
        ai_description: `${name} — ${(listing as { size_ml?: number }).size_ml}ml, ${(listing as { fill_percentage?: number }).fill_percentage}% full, ${(listing as { condition?: string }).condition}. $${price.toFixed(2)} AUD. From Scent Sell marketplace.`,
        metadata: { scentsell_sync_key: syncKey, source: 'scentsell-marketplace', listing_id: listing.id, price },
        is_archived: false,
        source_type: 'import',
      })

      results.marketplace++
      results.newItems.push(name)
    }
  }

  // ── 2. Sync Sample Shop Items ──────────────────────────────────────────

  const { data: shopItems } = await scentsell
    .from('scent_shop_items')
    .select('id, brand, fragrance_name, primary_image_url, gallery_images, base_price_aud, item_type, is_active')
    .eq('is_active', true)
    .eq('draft_mode', false)
    .order('created_at', { ascending: false })
    .limit(200)

  if (shopItems?.length) {
    for (const item of shopItems) {
      const imageUrl = (item as { primary_image_url?: string }).primary_image_url
      if (!imageUrl) continue

      const syncKey = `shop-${item.id}`
      if (existingSyncKeys.has(syncKey)) { results.skipped++; continue }

      const name = `${(item as { brand?: string }).brand} ${(item as { fragrance_name?: string }).fragrance_name}`

      await nrs.from('media_items').insert({
        user_id: brand.user_id,
        brand_id: brand.id,
        file_url: imageUrl,
        file_name: `ScentSell-Shop-${name.replace(/[^a-zA-Z0-9]/g, '-')}`,
        file_type: 'image/jpeg',
        file_size_bytes: 0,
        tags: [
          'sample-shop', 'fragrance', (item as { item_type?: string }).item_type ?? 'decant',
          ((item as { brand?: string }).brand ?? '').toLowerCase(),
          ((item as { fragrance_name?: string }).fragrance_name ?? '').toLowerCase(),
        ].filter(Boolean),
        ai_description: `${name} — ${(item as { item_type?: string }).item_type}${(item as { base_price_aud?: number }).base_price_aud ? `. From $${(item as { base_price_aud: number }).base_price_aud.toFixed(2)} AUD` : ''}. From Scent Sell sample shop.`,
        metadata: { scentsell_sync_key: syncKey, source: 'scentsell-shop', item_id: item.id },
        is_archived: false,
        source_type: 'import',
      })

      results.sampleShop++
      results.newItems.push(`${name} (sample)`)
    }
  }

  // ── 3. Alert Director about new products ───────────────────────────────

  if (results.newItems.length > 0) {
    const { memoryStore } = await import('@/lib/ruflo/client')
    await memoryStore(
      `scentsell-sync-${Date.now()}`,
      `NEW SCENT SELL PRODUCTS SYNCED (${new Date().toLocaleDateString('en-AU')}): ${results.newItems.join(', ')}. Now in Media Pantry — consider creating social posts about them.`,
      'nrs-scent-sell-overall',
      ['scentsell', 'sync', 'new-products', 'alert']
    )
  }

  return NextResponse.json({
    success: true,
    message: `Synced ${results.marketplace} marketplace + ${results.sampleShop} sample shop items (${results.skipped} already synced)`,
    ...results,
  })
}
