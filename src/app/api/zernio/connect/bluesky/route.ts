import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { userSafeError } from '@/lib/errors/user-safe'
import { zernioProfileForBrand } from '@/lib/auth/brand-zernio-profile'
import { ensureBrandZernioProfile } from '@/lib/zernio/brand-profile'
import { recordZernioAccountMapping, zernioConnectFailure } from '@/lib/zernio/connect'
import { BlueskyCredentialsRejected, connectBlueskyAccount } from '@/lib/zernio/connect-credentials'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Connect a Bluesky account from an app password.
 *
 * ── Why this route exists at all ───────────────────────────────────────
 *
 * The Bluesky tile has been on the connect grid since it shipped, and the
 * dialog has always posted here. Nothing answered. Next replies 404 with an
 * HTML body, `res.json()` yields null, and the owner gets the house sentence
 * about not being able to connect just now — a door drawn on a wall. This is
 * the room behind it.
 *
 * ── An app password is a credential ────────────────────────────────────
 *
 * It arrives in the body, goes out in the request to the publisher, and ends
 * there. It is not stored, not logged, not echoed back, and never put in a URL.
 * The only thing this route writes down is the account id the publisher minted
 * and which brand it belongs to. That is the same rule the headless OAuth flow
 * follows for a platform token, applied to the one platform where the owner
 * types the credential himself.
 *
 * ── The same tenant rules as every other connect route ─────────────────
 *
 * `getUser` first, then the brand is resolved through the workspace rules
 * (`zernioProfileForBrand`), then the brand's publisher profile is created if
 * it has never had one, and only then does anything leave this server. The
 * accountId → brand row is ours and is what decides whose account this is:
 * the publisher validates an account id against our whole TEAM, so its answer
 * can never be the thing that decides.
 */

const NOT_SIGNED_IN =
  'You are not signed in, so nothing was connected. Sign in and try again.'

const NOT_YOURS =
  'That business could not be opened under this sign-in, so nothing was connected. If it belongs to someone else’s workspace, it has to be connected from their account.'

const MISSING_FIELDS =
  'Enter your handle and the app password you made, then try again. Nothing has been changed.'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: NOT_SIGNED_IN }, { status: 401 })

    const body = await request.json().catch(() => null) as
      | { brandId?: unknown; identifier?: unknown; appPassword?: unknown }
      | null

    const brandId = typeof body?.brandId === 'string' ? body.brandId.trim() : ''
    // A leading @ is habit, and Bluesky rejects it. The form strips one already;
    // stripping it again here means a caller that is not the form gets the same
    // treatment rather than an unexplained refusal.
    const identifier = typeof body?.identifier === 'string' ? body.identifier.trim().replace(/^@/, '') : ''
    const appPassword = typeof body?.appPassword === 'string' ? body.appPassword.trim() : ''

    if (!brandId) {
      return NextResponse.json(
        { error: 'Choose a business first — an account is connected to one business at a time.' },
        { status: 400 },
      )
    }
    if (identifier === '' || appPassword === '') {
      return NextResponse.json({ error: MISSING_FIELDS }, { status: 400 })
    }

    const access = await zernioProfileForBrand(supabase, user.id, brandId)
    if (access.access === 'denied') return NextResponse.json({ error: NOT_YOURS }, { status: 403 })

    const { profileId } = await ensureBrandZernioProfile(supabase, access.brand)

    const account = await connectBlueskyAccount({ identifier, appPassword, profileId })

    await recordZernioAccountMapping(supabase, {
      accountId: account.accountId,
      brandId: access.brand.brandId,
      profileId,
      // The publisher's own answer, not our request. They agree today; the row
      // the webhook handler looks up by is this one, so it takes theirs.
      platform: account.platform || 'bluesky',
      username: account.username,
    })

    return NextResponse.json({
      connected: true,
      brandId: access.brand.brandId,
      platform: account.platform || 'bluesky',
      account: {
        accountId: account.accountId,
        name: account.displayName ?? account.username ?? 'Bluesky',
        username: account.username,
      },
    })
  } catch (err) {
    /*
     * A refused credential is not a broken service, and the two must not read
     * alike. `zernioConnectFailure` would answer 502 and tell the owner we
     * could not reach anything, sending him to look for a fault that is not
     * there — when the fix is a fresh app password.
     */
    if (err instanceof BlueskyCredentialsRejected) {
      console.error(`[api/zernio/connect/bluesky] ${err.message}`)
      return NextResponse.json({ connected: false, error: err.ownerMessage }, { status: 400 })
    }

    const failure = zernioConnectFailure('api/zernio/connect/bluesky', err)
    return NextResponse.json(failure.body, { status: failure.status, headers: failure.headers })
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: userSafeError(
        'api/zernio/connect/bluesky GET',
        new Error('GET is not supported'),
        'Connecting an account changes this business, so it has to be sent as a request rather than opened as a link.',
      ),
    },
    { status: 405 },
  )
}
