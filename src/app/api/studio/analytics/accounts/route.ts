import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapAccountsToBrandsRaw } from '@/lib/mixpost/brand-mapping'
import { RESULTS_NOT_COLLECTED } from '@/lib/analytics/platform-metrics'

export const dynamic = 'force-dynamic'

/**
 * The accounts a business actually has, for the businesses nobody measures.
 *
 * ── The sentence this route exists to delete ───────────────────────────
 * The selector row above the results screen was built from one source, and
 * that source only knows the two businesses linked to a results profile. For
 * the other twelve it answered "not linked", the row rendered
 * "No connected accounts yet — nothing is connected for this business", and
 * that was flatly untrue: Downscale has accounts connected and posts
 * published. Telling a regulated health brand it has no accounts when it does
 * is the kind of thing that makes an owner stop believing the whole product.
 *
 * So the row now asks here as well. This route answers the honest question —
 * *which accounts does this business have* — separately from the one the
 * screen kept confusing it with, *are their results being collected*. They are
 * not the same question and this payload keeps them apart:
 *
 *   accounts.length > 0, resultsCollected false  → connected, unmeasured
 *   accounts.length === 0, problem === null      → genuinely nothing connected
 *   problem set                                  → we could not look; say so
 *
 * ── Scoping ────────────────────────────────────────────────────────────
 * The publisher's account list is workspace-wide — every business at once. It
 * is mapped to brands over the caller's WHOLE brand set before this brand's
 * bucket is taken, because the mapping claims each account for its best match
 * and running it against a single brand would hand it accounts belonging to
 * its siblings. Only this brand's bucket leaves the route.
 *
 * A failed read returns an empty list WITH a problem, never an empty list on
 * its own — an unread list must not be able to masquerade as an empty one.
 */

/** X is out of scope for this product and never appears on this desk. */
const EXCLUDED_PROVIDERS = new Set(['x', 'twitter'])

const COULD_NOT_LOOK =
  'We could not check which accounts this business has just now. Nothing has been changed — try again in a moment.'

export interface StudioAnalyticsAccount {
  id: string
  platform: string
  label: string
  username?: string
  image?: string
  /** Whether this connection can report figures. False here means nobody is measuring. */
  canFetchAnalytics: boolean | null
  health: 'healthy' | 'warning' | 'error' | 'unknown'
}

export interface StudioAnalyticsAccountsPayload {
  accounts: StudioAnalyticsAccount[]
  /** False when nobody is gathering results for this business at all. */
  resultsCollected: boolean
  /** The owner-facing sentence for that, when it applies. */
  notCollected: string | null
  problem: string | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const brandId = req.nextUrl.searchParams.get('brandId')
  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }

  // RLS decides ownership; a brand from another workspace matches no row.
  const { data: brand, error: brandErr } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .maybeSingle()

  if (brandErr || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  // Every brand this person can see, so the mapping can claim each account for
  // its best match rather than over-claiming onto the one brand we asked about.
  const { data: allBrands } = await supabase
    .from('brands')
    .select('id, name, slug, social_urls')

  const workspaceAccounts = await fetchMixpostAccounts()

  if (!workspaceAccounts || !allBrands) {
    const payload: StudioAnalyticsAccountsPayload = {
      accounts: [],
      resultsCollected: false,
      notCollected: null,
      problem: COULD_NOT_LOOK,
    }
    return NextResponse.json(payload)
  }

  const byBrand = mapAccountsToBrandsRaw(
    workspaceAccounts,
    allBrands.map((row) => ({
      id: row.id,
      name: row.name ?? '',
      slug: row.slug ?? '',
      social_urls: (row.social_urls ?? {}) as Record<string, string>,
    })),
  )

  const mine = (byBrand.get(brandId) ?? []).filter(
    (account) => !EXCLUDED_PROVIDERS.has(account.provider.toLowerCase()),
  )

  const accounts: StudioAnalyticsAccount[] = mine.map((account) => ({
    id: String(account.id),
    platform: account.provider.toLowerCase(),
    label: account.name || account.username || account.provider,
    ...(account.username ? { username: account.username } : {}),
    ...(account.media_url ? { image: account.media_url } : {}),
    // Nobody is collecting figures for these, and that is knowledge, not a
    // failed lookup — so it is `false` rather than `null`.
    canFetchAnalytics: false,
    health: account.authorized === false ? ('error' as const) : ('unknown' as const),
  }))

  const payload: StudioAnalyticsAccountsPayload = {
    accounts,
    resultsCollected: false,
    notCollected: accounts.length > 0 ? RESULTS_NOT_COLLECTED : null,
    problem: null,
  }
  return NextResponse.json(payload)
}
