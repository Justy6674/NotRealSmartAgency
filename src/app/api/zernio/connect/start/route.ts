import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { ensureBrandZernioProfile } from '@/lib/zernio/brand-profile'
import {
  connectCookieOptions,
  isConnectablePlatform,
  signConnectState,
  START_COOKIE,
  startHeadlessConnect,
  zernioConnectFailure,
} from '@/lib/zernio/connect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Begin a headless connection for one brand the caller owns.
 *
 * Different from `/api/zernio/connect` in two ways that matter:
 *
 *   - It asks for `headless=true`, so the person comes back to OUR page picker
 *     instead of Zernio's. See `src/lib/zernio/connect.ts` for the reasoning
 *     and for the three rules that follow from holding a token that is not ours.
 *   - It CREATES the brand's publisher profile if the brand has never had one.
 *     Twelve brands in this workspace could not connect anything because the
 *     older route refused an unlinked brand outright. Creating is safe here and
 *     was not safe there: this route establishes the caller with `getUser`,
 *     resolves the brand through the workspace rules, and writes through the
 *     session client so RLS is what permits the update.
 *
 * The state is signed and carries the brandId. Zernio's own `state` proves the
 * OAuth round trip happened; it says nothing about which of our brands asked,
 * so without ours a person could start a connection on a brand they own and
 * finish it onto one they do not. A nonce cookie is set alongside it so a state
 * minted in one browser cannot be completed in another.
 */

const NOT_SIGNED_IN =
  'You are not signed in, so no connection was started. Sign in and try again.'

const NOT_YOURS =
  'That business could not be opened under this sign-in, so no connection was started. If it belongs to someone else’s workspace, it has to be connected from their account.'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const body = await request.json().catch(() => null) as
      | { brandId?: unknown; platform?: unknown; loginMethod?: unknown }
      | null

    const brandId = typeof body?.brandId === 'string' ? body.brandId : ''
    const platform = body?.platform

    if (!brandId || typeof platform !== 'string') {
      return NextResponse.json(
        { error: 'Choose a business and a platform first — a connection belongs to one business.' },
        { status: 400 },
      )
    }

    if (!isConnectablePlatform(platform)) {
      return NextResponse.json(
        { error: 'That is not a platform this site can connect, so nothing was started.' },
        { status: 400 },
      )
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') return NextResponse.json({ error: NOT_YOURS }, { status: 403 })

    const { profileId, created } = await ensureBrandZernioProfile(supabase, access.brand)

    const nonce = randomUUID()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

    // Our state rides on the redirect_url, not on Zernio's `state` — that one is
    // theirs and is round-tripped by the platform. Zernio appends its own result
    // params with the URL API, so an existing query string survives.
    const state = signConnectState({
      brandId: access.brand.brandId,
      platform,
      profileId,
      nonce,
    })

    const redirectUrl = new URL('/api/zernio/connect/callback', appUrl)
    redirectUrl.searchParams.set('nrs_state', state)

    const { authUrl } = await startHeadlessConnect({
      platform,
      profileId,
      redirectUrl: redirectUrl.toString(),
      ...(body?.loginMethod === 'facebook_login' || body?.loginMethod === 'instagram_login'
        ? { loginMethod: body.loginMethod }
        : {}),
    })

    // Written only now, once everything above has held: signed in, brand theirs,
    // platform recognised, profile in place, publisher ready.
    const cookieStore = await cookies()
    cookieStore.set(START_COOKIE, nonce, connectCookieOptions())

    return NextResponse.json({
      authUrl,
      brandId: access.brand.brandId,
      platform,
      profileId,
      profileCreated: created,
    })
  } catch (err) {
    const failure = zernioConnectFailure('api/zernio/connect/start', err)
    return NextResponse.json(failure.body, { status: failure.status, headers: failure.headers })
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: userSafeError(
        'api/zernio/connect/start GET',
        new Error('GET is not supported'),
        'Starting a connection changes this business, so it has to be sent as a request rather than opened as a link.',
      ),
    },
    { status: 405 },
  )
}
