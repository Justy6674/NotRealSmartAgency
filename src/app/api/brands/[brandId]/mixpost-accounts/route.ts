import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import {
  mapMixpostAccountsToBrands,
  getConfirmedAccountIds,
} from '@/lib/mixpost/brand-mapping'

export const dynamic = 'force-dynamic'

/**
 * GET /api/brands/[brandId]/mixpost-accounts
 *
 * Returns the Mixpost account mapping for a brand:
 * - confirmed: manually confirmed accounts (from social_urls.mixpost_account_ids)
 * - suggested: fuzzy-matched accounts (only if no confirmed IDs)
 * - all: every Mixpost account available for selection
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Fetch brand
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, name, slug, social_urls')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  // Fetch all Mixpost accounts
  const allAccounts = await fetchMixpostAccounts()
  if (!allAccounts) {
    return NextResponse.json({
      error: 'Mixpost not configured or unreachable',
      confirmed: [],
      suggested: [],
      all: [],
    })
  }

  const confirmedIds = getConfirmedAccountIds(brand)
  const confirmed = allAccounts.filter(a => confirmedIds.includes(a.id))

  // Get fuzzy-matched suggestions (only useful when no confirmed IDs)
  let suggested = allAccounts.filter(() => false) // empty by default
  if (confirmedIds.length === 0) {
    const mapping = mapMixpostAccountsToBrands(allAccounts, [brand])
    const brandMapping = mapping[brand.id] ?? []
    const suggestedNames = new Set(brandMapping.map(m => m.accountName))
    suggested = allAccounts.filter(a => suggestedNames.has(a.name))
  }

  return NextResponse.json({
    confirmed,
    suggested,
    all: allAccounts,
  })
}

/**
 * PUT /api/brands/[brandId]/mixpost-accounts
 *
 * Saves confirmed Mixpost account IDs for a brand.
 * Stores as JSON string in social_urls.mixpost_account_ids.
 *
 * Body: { account_ids: number[] }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const accountIds: unknown = body.account_ids

  if (!Array.isArray(accountIds) || !accountIds.every((id) => typeof id === 'number')) {
    return NextResponse.json(
      { error: 'account_ids must be an array of numbers' },
      { status: 400 },
    )
  }

  // Fetch current brand to preserve existing social_urls
  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, social_urls')
    .eq('id', brandId)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  const currentUrls = (brand.social_urls as Record<string, string>) ?? {}
  const updatedUrls = {
    ...currentUrls,
    mixpost_account_ids: JSON.stringify(accountIds),
  }

  const { error: updateError } = await supabase
    .from('brands')
    .update({ social_urls: updatedUrls })
    .eq('id', brandId)

  if (updateError) {
    console.error('[mixpost-accounts] Update error:', updateError)
    return NextResponse.json({ error: 'Failed to save account mapping' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    account_ids: accountIds,
  })
}
