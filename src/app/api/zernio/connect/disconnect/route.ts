import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import {
  deleteZernioAccount,
  liveMappingFor,
  markZernioAccountDisconnected,
  zernioConnectFailure,
} from '@/lib/zernio/connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Take one account off a business.
 *
 * ── The order is the whole design ──────────────────────────────────────
 *
 * 1. Establish the caller and that the business is theirs.
 * 2. Prove the account is THIS business's, from OUR map.
 * 3. Delete it upstream.
 * 4. Mark the mapping disconnected. Never delete the row.
 *
 * Step 2 is not a formality. Zernio validates an account id against the whole
 * TEAM, not against a profile — measured on 2026-08-17 and pinned by
 * `account-scoping.test.ts`. Our team holds every subscriber's accounts, so a
 * request naming another customer's Facebook Page would be honoured upstream
 * without complaint. The only thing that makes this route safe is that we check
 * the id against `zernio_account_map` first, in our own database.
 *
 * Step 3 before step 4 because deleting upstream is what actually stops the
 * account posting; our row is bookkeeping. If step 4 then fails the operator
 * gets an error and a retry is safe — a second delete of an account that is
 * already gone reads as success, so the retry reaches the marking.
 *
 * Step 4 marks rather than deletes because the row is the only record that this
 * account was ever this business's. Deleting it orphans every `publisher_runs`
 * row naming the account, and the webhook handler silently drops any inbox
 * event whose accountId resolves to nothing — a comment on a post published
 * last week would vanish with no trace of why.
 */

const NOT_SIGNED_IN = 'You are not signed in, so nothing was changed. Sign in and try again.'

const NOT_YOURS =
  'That business could not be opened under this sign-in, so nothing was changed. If it belongs to someone else’s workspace, it has to be changed from their account.'

const NOT_LINKED =
  'That account is not connected to this business, so nothing was changed.'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const body = await request.json().catch(() => null) as
      | { brandId?: unknown; accountId?: unknown }
      | null

    const brandId = typeof body?.brandId === 'string' ? body.brandId.trim() : ''
    const accountId = typeof body?.accountId === 'string' ? body.accountId.trim() : ''

    if (brandId === '' || accountId === '') {
      return NextResponse.json(
        { error: 'Choose a business and an account first — nothing has been changed.' },
        { status: 400 },
      )
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') return NextResponse.json({ error: NOT_YOURS }, { status: 403 })

    const mapping = await liveMappingFor(supabase, { brandId: access.brand.brandId, accountId })
    if (!mapping) return NextResponse.json({ error: NOT_LINKED }, { status: 404 })

    const { alreadyGone } = await deleteZernioAccount(accountId)
    await markZernioAccountDisconnected(supabase, { brandId: access.brand.brandId, accountId })

    return NextResponse.json({
      disconnected: true,
      brandId: access.brand.brandId,
      accountId,
      platform: mapping.platform,
      // True when the account had already been removed on the platform's side —
      // worth saying, because "it was already gone" and "we removed it" look
      // identical on the screen and only one of them is a surprise.
      alreadyGone,
    })
  } catch (err) {
    const failure = zernioConnectFailure('api/zernio/connect/disconnect', err)
    return NextResponse.json(failure.body, { status: failure.status, headers: failure.headers })
  }
}
