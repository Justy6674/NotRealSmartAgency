export const maxDuration = 300 // 5 minutes for multiple brands

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { researchIndustryCore } from '@/lib/agents/tools/research-industry'

export async function POST(request: Request) {
  // Auth — must be an authenticated user (admin check via owner status)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const brandIds = body.brandIds as string[] | undefined
  const forceRefresh = body.forceRefresh === true

  // Use admin client for cross-user access if needed
  const admin = createAdminClient()

  // Find brands to research
  let query = admin
    .from('brands')
    .select('id, name, niche, user_id')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (brandIds?.length) {
    query = query.in('id', brandIds)
  }

  const { data: brands, error: brandsError } = await query
  if (brandsError) return NextResponse.json({ error: brandsError.message }, { status: 500 })
  if (!brands?.length) return NextResponse.json({ error: 'No brands found' }, { status: 404 })

  // Filter to only brands with RED market_context (unless forceRefresh)
  const brandsToResearch: typeof brands = []

  if (forceRefresh) {
    brandsToResearch.push(...brands)
  } else {
    for (const brand of brands) {
      const { data: mc } = await admin
        .from('brand_proforma_sections')
        .select('rag_status')
        .eq('brand_id', brand.id)
        .eq('section_key', 'market_context')
        .single()

      if (!mc || mc.rag_status === 'red') {
        brandsToResearch.push(brand)
      }
    }
  }

  if (!brandsToResearch.length) {
    return NextResponse.json({
      message: 'All brands already have industry research (market_context is GREEN/AMBER). Use forceRefresh: true to re-research.',
      brands_checked: brands.length,
    })
  }

  // Research each brand (concurrency 2)
  const results: { brand: string; success: boolean; summary?: string; error?: string }[] = []

  // Process in batches of 2
  for (let i = 0; i < brandsToResearch.length; i += 2) {
    const batch = brandsToResearch.slice(i, i + 2)
    const batchResults = await Promise.allSettled(
      batch.map(async (brand) => {
        const result = await researchIndustryCore(
          admin,
          brand.id,
          brand.user_id,
          'deep'
        )
        return { brand: brand.name, ...result }
      })
    )

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value)
      } else {
        results.push({
          brand: batch[results.length % batch.length]?.name ?? 'Unknown',
          success: false,
          error: String(r.reason),
        })
      }
    }
  }

  return NextResponse.json({
    researched: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    total: brandsToResearch.length,
    results,
  })
}
